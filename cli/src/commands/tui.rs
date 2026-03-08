//! Terminal UI for live monitoring and operations. Tabs: Dashboard, Config, Roles, Blacklist,
//! Events, Fees (SSS-4), Operations, Compliance.
//! Press Tab to switch, r to refresh, q to quit.
//! On Operations/Compliance: select action with Up/Down, Enter to open form, fill fields, Enter to submit.
use anyhow::{anyhow, Result};
use chrono::Local;
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Table, Tabs, Wrap},
    Frame, Terminal,
};
use solana_sdk::pubkey::Pubkey;
use std::io;
use std::time::Duration;

use crate::commands::{blacklist, burn, freeze, mint, pause, roles, seize, thaw};
use crate::config::CliContext;
use crate::utils::*;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Tab {
    Dashboard,
    Config,
    Roles,
    Blacklist,
    Events,
    Fees,
    Operations,
    Compliance,
}

impl Tab {
    const ALL: [Tab; 8] = [
        Tab::Dashboard,
        Tab::Config,
        Tab::Roles,
        Tab::Blacklist,
        Tab::Events,
        Tab::Fees,
        Tab::Operations,
        Tab::Compliance,
    ];

    fn title(&self) -> &'static str {
        match self {
            Tab::Dashboard => "Dashboard",
            Tab::Config => "Config",
            Tab::Roles => "Roles",
            Tab::Blacklist => "Blacklist",
            Tab::Events => "Events",
            Tab::Fees => "Fees",
            Tab::Operations => "Operations",
            Tab::Compliance => "Compliance",
        }
    }

    fn index(&self) -> usize {
        match self {
            Tab::Dashboard => 0,
            Tab::Config => 1,
            Tab::Roles => 2,
            Tab::Blacklist => 3,
            Tab::Events => 4,
            Tab::Fees => 5,
            Tab::Operations => 6,
            Tab::Compliance => 7,
        }
    }

    fn from_index(i: usize) -> Tab {
        Tab::ALL[i % 8]
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Op {
    Mint,
    Burn,
    Freeze,
    Thaw,
    Pause,
    Unpause,
    Seize,
}

impl Op {
    const ALL: [Op; 7] = [
        Op::Mint,
        Op::Burn,
        Op::Freeze,
        Op::Thaw,
        Op::Pause,
        Op::Unpause,
        Op::Seize,
    ];
    fn title(&self) -> &'static str {
        match self {
            Op::Mint => "Mint",
            Op::Burn => "Burn",
            Op::Freeze => "Freeze",
            Op::Thaw => "Thaw",
            Op::Pause => "Pause",
            Op::Unpause => "Unpause",
            Op::Seize => "Seize",
        }
    }
    fn fields(&self) -> &[&'static str] {
        match self {
            Op::Mint => &["Recipient (pubkey)", "Amount (raw)"],
            Op::Burn => &["From owner (pubkey)", "Amount (raw)"],
            Op::Freeze => &["Token account (pubkey)"],
            Op::Thaw => &["Token account (pubkey)"],
            Op::Pause | Op::Unpause => &[],
            Op::Seize => &["From (token account)", "To (token account)", "Amount (raw)"],
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum ComplianceOp {
    AddBlacklist,
    RemoveBlacklist,
    GrantRole,
    RevokeRole,
}

impl ComplianceOp {
    const ALL: [ComplianceOp; 4] = [
        ComplianceOp::AddBlacklist,
        ComplianceOp::RemoveBlacklist,
        ComplianceOp::GrantRole,
        ComplianceOp::RevokeRole,
    ];
    fn title(&self) -> &'static str {
        match self {
            ComplianceOp::AddBlacklist => "Add to blacklist",
            ComplianceOp::RemoveBlacklist => "Remove from blacklist",
            ComplianceOp::GrantRole => "Grant role",
            ComplianceOp::RevokeRole => "Revoke role",
        }
    }
    fn fields(&self) -> &[&'static str] {
        match self {
            ComplianceOp::AddBlacklist => &["Address (pubkey)", "Reason"],
            ComplianceOp::RemoveBlacklist => &["Address (pubkey)"],
            ComplianceOp::GrantRole => &["Address (pubkey)", "Role (admin/minter/...)"],
            ComplianceOp::RevokeRole => &["Address (pubkey)", "Role (admin/minter/...)"],
        }
    }
}

enum FormState {
    Operation { op: Op, field_idx: usize, values: Vec<String> },
    Compliance { op: ComplianceOp, field_idx: usize, values: Vec<String> },
}

struct RoleStatus {
    name: &'static str,
    role_u8: u8,
    active: bool,
}

struct EventEntry {
    timestamp: String,
    message: String,
}

struct TuiState {
    config_data: Option<ParsedConfig>,
    roles: Vec<RoleStatus>,
    events: Vec<EventEntry>,
    selected_index: usize,
    error_message: Option<String>,
    form: Option<FormState>,
}

impl TuiState {
    fn new() -> Self {
        let events = vec![EventEntry {
            timestamp: Local::now().format("%H:%M:%S").to_string(),
            message: "TUI started".to_string(),
        }];
        Self {
            config_data: None,
            roles: Vec::new(),
            events,
            selected_index: 0,
            error_message: None,
            form: None,
        }
    }

    fn push_event(&mut self, message: &str) {
        self.events.push(EventEntry {
            timestamp: Local::now().format("%H:%M:%S").to_string(),
            message: message.to_string(),
        });
        if self.events.len() > 200 {
            self.events.drain(0..50);
        }
    }

    fn list_len(&self, tab: Tab) -> usize {
        match tab {
            Tab::Roles => self.roles.len(),
            Tab::Events => self.events.len(),
            Tab::Operations => Op::ALL.len(),
            Tab::Compliance => ComplianceOp::ALL.len(),
            _ => 0,
        }
    }
}

pub fn run(ctx: &CliContext, mint_arg: Option<&str>) -> Result<()> {
    let mut mint_str = mint_arg.map(String::from).unwrap_or_default();
    let editable = mint_arg.is_none();

    let mut state = TuiState::new();

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut tab = Tab::Dashboard;

    // Initial refresh when mint is valid
    if let Ok(mint) = parse_pubkey(&mint_str) {
        refresh(ctx, &mint, &mut state);
    }

    loop {
        terminal.draw(|f| draw_ui(f, ctx, &mint_str, &tab, &state, editable))?;

        if event::poll(Duration::from_millis(500))? {
            if let Event::Key(key) = event::read()? {
                if key.kind != KeyEventKind::Press {
                    continue;
                }
                match key.code {
                    KeyCode::Char('q') => break,
                    KeyCode::Esc => {
                        state.form = None;
                    }
                    KeyCode::Char('r') if state.form.is_none() => {
                        if let Ok(mint) = parse_pubkey(&mint_str) {
                            refresh(ctx, &mint, &mut state);
                        }
                    }
                    key_code => {
                        if let Some(mut form) = state.form.take() {
                            let (close, should_refresh) = handle_form_key(&mut form, key_code, ctx, &mint_str, &mut state);
                            if !close {
                                state.form = Some(form);
                            } else if should_refresh {
                                if let Ok(mint) = parse_pubkey(mint_str.trim()) {
                                    refresh(ctx, &mint, &mut state);
                                }
                            }
                        } else {
                            match key_code {
                                KeyCode::Tab => {
                                    if key.modifiers.contains(KeyModifiers::SHIFT) {
                                        let idx = (tab.index() + 7) % 8;
                                        tab = Tab::from_index(idx);
                                    } else {
                                        tab = Tab::from_index((tab.index() + 1) % 8);
                                    }
                                    state.selected_index = 0;
                                }
                                KeyCode::BackTab => {
                                    tab = Tab::from_index((tab.index() + 7) % 8);
                                    state.selected_index = 0;
                                }
                                KeyCode::Up => {
                                    let max = state.list_len(tab);
                                    if max > 0 {
                                        state.selected_index = (state.selected_index + max - 1) % max;
                                    }
                                }
                                KeyCode::Down => {
                                    let max = state.list_len(tab);
                                    if max > 0 {
                                        state.selected_index = (state.selected_index + 1) % max;
                                    }
                                }
                                KeyCode::Char(c) if editable && c != 'q' && c != 'r' => {
                                    mint_str.push(c);
                                }
                                KeyCode::Backspace if editable => {
                                    mint_str.pop();
                                }
                                KeyCode::Enter if mint_str.trim().is_empty() => {}
                                KeyCode::Enter => {
                                    if tab == Tab::Operations && parse_pubkey(mint_str.trim()).is_ok() {
                                        let op = Op::ALL[state.selected_index.min(Op::ALL.len() - 1)];
                                        let values = op.fields().iter().map(|_| String::new()).collect();
                                        state.form = Some(FormState::Operation {
                                            op,
                                            field_idx: 0,
                                            values,
                                        });
                                    } else if tab == Tab::Compliance && parse_pubkey(mint_str.trim()).is_ok() {
                                        let cop = ComplianceOp::ALL[state.selected_index.min(ComplianceOp::ALL.len() - 1)];
                                        let values = cop.fields().iter().map(|_| String::new()).collect();
                                        state.form = Some(FormState::Compliance {
                                            op: cop,
                                            field_idx: 0,
                                            values,
                                        });
                                    } else {
                                        state.error_message = None;
                                        if let Ok(mint) = parse_pubkey(&mint_str) {
                                            refresh(ctx, &mint, &mut state);
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    Ok(())
}

/// Returns (close_form, should_refresh).
fn handle_form_key(
    form: &mut FormState,
    key: KeyCode,
    ctx: &CliContext,
    mint_str: &str,
    state: &mut TuiState,
) -> (bool, bool) {
    let (fields, field_idx, values, is_operation) = match form {
        FormState::Operation { op, field_idx, values } => (op.fields(), *field_idx, values, true),
        FormState::Compliance { op, field_idx, values } => (op.fields(), *field_idx, values, false),
    };
    match key {
        KeyCode::Char(c) => {
            if field_idx < values.len() {
                values[field_idx].push(c);
            }
        }
        KeyCode::Backspace => {
            if field_idx < values.len() {
                values[field_idx].pop();
            }
        }
        KeyCode::Tab | KeyCode::Enter => {
            if field_idx + 1 < fields.len() {
                *match form {
                    FormState::Operation { field_idx, .. } => field_idx,
                    FormState::Compliance { field_idx, .. } => field_idx,
                } = field_idx + 1;
            } else {
                let res = if is_operation {
                    execute_operation(ctx, mint_str, form)
                } else {
                    execute_compliance(ctx, mint_str, form)
                };
                let (ok, msg) = match res {
                    Ok(sig) => (true, format!("Tx: {}", sig)),
                    Err(e) => {
                        state.error_message = Some(e.to_string());
                        (false, format!("Error: {}", e))
                    }
                };
                state.push_event(&msg);
                return (true, ok);
            }
        }
        _ => {}
    }
    (false, false)
}

fn execute_operation(ctx: &CliContext, mint_str: &str, form: &FormState) -> Result<String> {
    let FormState::Operation { op, values, .. } = form else {
        return Err(anyhow!("Expected operation form"));
    };
    let mint_str = mint_str.trim();
    match op {
        Op::Mint => {
            let to = values.get(0).map(|s| s.as_str()).unwrap_or("");
            let amount: u64 = values.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            mint::execute(ctx, mint_str, to, amount)
        }
        Op::Burn => {
            let from = values.get(0).map(|s| s.as_str()).unwrap_or("");
            let amount: u64 = values.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            burn::execute(ctx, mint_str, from, amount)
        }
        Op::Freeze => {
            let account = values.get(0).map(|s| s.as_str()).unwrap_or("");
            freeze::execute(ctx, mint_str, account)
        }
        Op::Thaw => {
            let account = values.get(0).map(|s| s.as_str()).unwrap_or("");
            thaw::execute(ctx, mint_str, account)
        }
        Op::Pause => pause::execute(ctx, mint_str, false),
        Op::Unpause => pause::execute(ctx, mint_str, true),
        Op::Seize => {
            let from = values.get(0).map(|s| s.as_str()).unwrap_or("");
            let to = values.get(1).map(|s| s.as_str()).unwrap_or("");
            let amount: u64 = values.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
            seize::execute(ctx, mint_str, from, to, amount)
        }
    }
}

fn execute_compliance(ctx: &CliContext, mint_str: &str, form: &FormState) -> Result<String> {
    let FormState::Compliance { op, values, .. } = form else {
        return Err(anyhow!("Expected compliance form"));
    };
    let mint_str = mint_str.trim();
    match op {
        ComplianceOp::AddBlacklist => {
            let address = values.get(0).map(|s| s.as_str()).unwrap_or("");
            let reason = values.get(1).map(|s| s.as_str()).unwrap_or("");
            blacklist::add_execute(ctx, mint_str, address, reason)
        }
        ComplianceOp::RemoveBlacklist => {
            let address = values.get(0).map(|s| s.as_str()).unwrap_or("");
            blacklist::remove_execute(ctx, mint_str, address)
        }
        ComplianceOp::GrantRole => {
            let address = values.get(0).map(|s| s.as_str()).unwrap_or("");
            let role = values.get(1).map(|s| s.as_str()).unwrap_or("");
            roles::grant_execute(ctx, mint_str, address, role)
        }
        ComplianceOp::RevokeRole => {
            let address = values.get(0).map(|s| s.as_str()).unwrap_or("");
            let role = values.get(1).map(|s| s.as_str()).unwrap_or("");
            roles::revoke_execute(ctx, mint_str, address, role)
        }
    }
}

fn refresh(ctx: &CliContext, mint: &Pubkey, state: &mut TuiState) {
    state.error_message = None;
    let (config_pda, _) = derive_config_pda(mint);

    // Fetch config
    match ctx.client.get_account(&config_pda) {
        Ok(account) => {
            match parse_config_account(&account.data) {
                Ok(cfg) => {
                    state.config_data = Some(cfg);
                    state.push_event("Config refreshed");
                }
                Err(e) => {
                    state.push_event(&format!("Error: config parse failed: {}", e));
                    state.error_message = Some(e.to_string());
                }
            }
        }
        Err(e) => {
            state.push_event(&format!("Error: config fetch failed: {}", e));
            state.error_message = Some(e.to_string());
        }
    }

    // Fetch roles
    let wallet = ctx.payer_pubkey();
    let roles_to_check: [(u8, &'static str); 7] = [
        (0, "Admin"),
        (1, "Minter"),
        (2, "Freezer"),
        (3, "Pauser"),
        (4, "Burner"),
        (5, "Blacklister"),
        (6, "Seizer"),
    ];
    let mut roles = Vec::new();
    for (role_u8, name) in roles_to_check {
        let (role_pda, _) = derive_role_pda(&config_pda, &wallet, role_u8);
        let active = ctx.client.get_account(&role_pda).is_ok();
        roles.push(RoleStatus {
            name,
            role_u8,
            active,
        });
    }
    state.roles = roles;
    state.push_event("Roles refreshed");
}

fn draw_ui(
    f: &mut Frame,
    ctx: &CliContext,
    mint_str: &str,
    tab: &Tab,
    state: &TuiState,
    editable: bool,
) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(0),
            Constraint::Length(3),
        ])
        .split(f.area());

    // Header with tabs
    draw_header(f, ctx, mint_str, tab, state, chunks[0]);

    // Content - error banner or tab content
    let content_area = if state.error_message.is_some() {
        let inner = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(3), Constraint::Min(0)])
            .split(chunks[1]);
        let err = state.error_message.as_ref().unwrap();
        let err_block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Red))
            .title(Span::styled(" Error ", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)));
        f.render_widget(
            Paragraph::new(err.as_str()).style(Style::default().fg(Color::Red)).block(err_block),
            inner[0],
        );
        inner[1]
    } else {
        chunks[1]
    };

    if let Some(ref form) = state.form {
        draw_form(f, form, mint_str, content_area);
    } else {
        draw_tab_content(f, mint_str, tab, state, editable, content_area);
    }

    // Footer
    draw_footer(f, chunks[2]);
}

fn draw_header(f: &mut Frame, ctx: &CliContext, mint_str: &str, tab: &Tab, _state: &TuiState, area: ratatui::layout::Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(1), Constraint::Length(2)])
        .split(area);

    let wallet_short = short_key(&ctx.payer_pubkey());
    let mint_display = if mint_str.is_empty() {
        "(enter mint address)".to_string()
    } else {
        short_key_str(mint_str)
    };
    let title_line = Line::from(vec![
        Span::styled(" SSS TUI ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(" Mint: "),
        Span::styled(mint_display, Style::default().fg(Color::Yellow)),
        Span::raw("  Wallet: "),
        Span::styled(wallet_short, Style::default().fg(Color::Green)),
    ]);
    f.render_widget(Paragraph::new(title_line), chunks[0]);

    let tab_titles: Vec<Line> = Tab::ALL
        .iter()
        .map(|t| {
            let style = if *t == *tab {
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD | Modifier::UNDERLINED)
            } else {
                Style::default().fg(Color::DarkGray)
            };
            Line::from(Span::styled(t.title(), style))
        })
        .collect();
    let tabs = Tabs::new(tab_titles)
        .block(Block::default().borders(Borders::BOTTOM).border_style(Style::default().fg(Color::DarkGray)))
        .highlight_style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))
        .select(tab.index())
        .divider(Span::styled(" | ", Style::default().fg(Color::DarkGray)));
    f.render_widget(tabs, chunks[1]);
}

fn draw_footer(f: &mut Frame, area: ratatui::layout::Rect) {
    let hints = Line::from(vec![
        Span::styled(" Tab", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(": Switch tabs  "),
        Span::styled("r", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(": Refresh  "),
        Span::styled("Enter", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(": Select/Submit  "),
        Span::styled("Esc", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(": Cancel  "),
        Span::styled("q", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::raw(": Quit"),
    ]);
    let footer = Paragraph::new(hints)
        .block(Block::default().borders(Borders::TOP).border_style(Style::default().fg(Color::DarkGray)));
    f.render_widget(footer, area);
}

fn draw_tab_content(
    f: &mut Frame,
    mint_str: &str,
    tab: &Tab,
    state: &TuiState,
    editable: bool,
    area: ratatui::layout::Rect,
) {
    let needs_mint = mint_str.is_empty() || parse_pubkey(mint_str).is_err();
    if needs_mint {
        let msg = if editable {
            "Type mint address (base58, 32-44 chars), press Enter, then 'r' to refresh. q to quit."
        } else {
            "No mint provided. Run with --mint <ADDRESS> to monitor."
        };
        let p = Paragraph::new(msg)
            .block(Block::default().borders(Borders::ALL).title("Info"))
            .wrap(Wrap { trim: true });
        f.render_widget(p, area);
        return;
    }

    match tab {
        Tab::Dashboard => draw_dashboard(f, state, area),
        Tab::Config => draw_config(f, state, area),
        Tab::Roles => draw_roles(f, state, area),
        Tab::Blacklist => draw_blacklist(f, area),
        Tab::Events => draw_events(f, state, area),
        Tab::Fees => draw_fees(f, state, area),
        Tab::Operations => draw_operations(f, state, area),
        Tab::Compliance => draw_compliance(f, state, area),
    }
}

fn draw_dashboard(f: &mut Frame, state: &TuiState, area: ratatui::layout::Rect) {
    let Some(ref cfg) = state.config_data else {
        let p = Paragraph::new("No data. Press 'r' to refresh.")
            .block(Block::default().borders(Borders::ALL).title("Dashboard"))
            .wrap(Wrap { trim: true });
        f.render_widget(p, area);
        return;
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(10), Constraint::Min(8)])
        .split(area);

    let pause_style = if cfg.paused {
        Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::Green)
    };
    let pause_text = if cfg.paused { "PAUSED" } else { "Active" };

    let info_lines = vec![
        Line::from(vec![
            Span::styled("  Mint:       ", Style::default().fg(Color::DarkGray)),
            Span::styled(cfg.mint.to_string(), Style::default().fg(Color::Yellow)),
        ]),
        Line::from(vec![
            Span::styled("  Authority:  ", Style::default().fg(Color::DarkGray)),
            Span::styled(cfg.authority.to_string(), Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("  Preset:     ", Style::default().fg(Color::DarkGray)),
            Span::styled(preset_name(cfg.preset).to_string(), Style::default().fg(Color::Magenta)),
        ]),
        Line::from(vec![
            Span::styled("  Status:     ", Style::default().fg(Color::DarkGray)),
            Span::styled(pause_text, pause_style),
        ]),
        Line::from(vec![
            Span::styled("  Decimals:   ", Style::default().fg(Color::DarkGray)),
            Span::styled(cfg.decimals.to_string(), Style::default().fg(Color::White)),
        ]),
    ];
    let mut info_lines = info_lines;
    if cfg.preset == 4 {
        info_lines.push(Line::from(vec![
            Span::styled("  Transfer Fee: ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                format!("{} bps, Max: {}", cfg.transfer_fee_basis_points, format_amount(cfg.maximum_fee, cfg.decimals)),
                Style::default().fg(Color::Cyan),
            ),
        ]));
    }
    let info_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Stablecoin Config ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));
    f.render_widget(Paragraph::new(info_lines).block(info_block), chunks[0]);

    let supply = cfg.current_supply();
    let cap_text = if cfg.has_supply_cap && cfg.supply_cap > 0 {
        format_amount(cfg.supply_cap, cfg.decimals)
    } else {
        "Unlimited".to_string()
    };
    let supply_lines = vec![
        Line::from(""),
        Line::from(vec![
            Span::styled("  Total Minted:  ", Style::default().fg(Color::DarkGray)),
            Span::styled(format_amount(cfg.total_minted, cfg.decimals), Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("  Total Burned:  ", Style::default().fg(Color::DarkGray)),
            Span::styled(format_amount(cfg.total_burned, cfg.decimals), Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("  Current Supply:", Style::default().fg(Color::DarkGray)),
            Span::styled(format!(" {}", format_amount(supply, cfg.decimals)), Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("  Supply Cap:    ", Style::default().fg(Color::DarkGray)),
            Span::styled(cap_text, Style::default().fg(Color::White)),
        ]),
    ];
    let supply_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Supply Stats ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));
    f.render_widget(Paragraph::new(supply_lines).block(supply_block), chunks[1]);
}

fn draw_config(f: &mut Frame, state: &TuiState, area: ratatui::layout::Rect) {
    let Some(ref cfg) = state.config_data else {
        let p = Paragraph::new("No data. Press 'r' to refresh.")
            .block(Block::default().borders(Borders::ALL).title("Config"))
            .wrap(Wrap { trim: true });
        f.render_widget(p, area);
        return;
    };

    let supply = cfg.current_supply();
    let mut lines = vec![
        Line::from(vec![Span::styled("Name: ", Style::default().fg(Color::Yellow)), Span::raw(cfg.name.clone())]),
        Line::from(vec![Span::styled("Symbol: ", Style::default().fg(Color::Yellow)), Span::raw(cfg.symbol.clone())]),
        Line::from(vec![Span::styled("Preset: ", Style::default().fg(Color::Yellow)), Span::raw(preset_name(cfg.preset).to_string())]),
        Line::from(vec![Span::styled("Supply: ", Style::default().fg(Color::Yellow)), Span::raw(format_amount(supply, cfg.decimals))]),
        Line::from(vec![
            Span::styled("Paused: ", Style::default().fg(Color::Yellow)),
            Span::raw(if cfg.paused { "Yes" } else { "No" }),
        ]),
    ];
    if cfg.preset == 4 {
        lines.push(Line::from(vec![
            Span::styled("Transfer Fee: ", Style::default().fg(Color::Yellow)),
            Span::raw(format!("{} bps, Max: {}", cfg.transfer_fee_basis_points, format_amount(cfg.maximum_fee, cfg.decimals))),
        ]));
    }
    let p = Paragraph::new(lines)
        .block(Block::default().borders(Borders::ALL).title("Config"))
        .wrap(Wrap { trim: true });
    f.render_widget(p, area);
}

fn draw_roles(f: &mut Frame, state: &TuiState, area: ratatui::layout::Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Roles ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));

    if state.roles.is_empty() {
        let rows = vec![Row::new(vec![
            Cell::from(""),
            Cell::from("No role data. Press 'r' to refresh."),
            Cell::from(""),
        ])
        .style(Style::default().fg(Color::Yellow))];
        let table = Table::new(
            rows,
            [Constraint::Length(6), Constraint::Min(30), Constraint::Length(10)],
        )
        .block(block);
        f.render_widget(table, area);
        return;
    }

    let header = Row::new(vec![
        Cell::from("  #").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        Cell::from("Role").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        Cell::from("Status").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
    ])
    .height(1)
    .bottom_margin(1);

    let rows: Vec<Row> = state
        .roles
        .iter()
        .enumerate()
        .map(|(i, role)| {
            let is_selected = i == state.selected_index;
            let (icon, color) = if role.active {
                ("\u{2713}", Color::Green)
            } else {
                ("\u{2717}", Color::Red)
            };
            let row_style = if is_selected {
                Style::default().add_modifier(Modifier::BOLD).bg(Color::DarkGray)
            } else {
                Style::default()
            };
            Row::new(vec![
                Cell::from(format!("  {}", role.role_u8)).style(Style::default().fg(Color::DarkGray)),
                Cell::from(role.name).style(Style::default().fg(Color::White)),
                Cell::from(icon).style(Style::default().fg(color).add_modifier(Modifier::BOLD)),
            ])
            .style(row_style)
            .height(1)
        })
        .collect();

    let table = Table::new(rows, [Constraint::Length(6), Constraint::Min(20), Constraint::Length(10)])
        .header(header)
        .block(block);
    f.render_widget(table, area);
}

fn draw_form(f: &mut Frame, form: &FormState, mint_str: &str, area: ratatui::layout::Rect) {
    let (title, fields, field_idx, values) = match form {
        FormState::Operation { op, field_idx, values } => {
            (op.title(), op.fields(), *field_idx, values)
        }
        FormState::Compliance { op, field_idx, values } => {
            (op.title(), op.fields(), *field_idx, values)
        }
    };
    let mut lines = vec![
        Line::from(vec![
            Span::styled(" Mint: ", Style::default().fg(Color::DarkGray)),
            Span::styled(short_key_str(mint_str.trim()), Style::default().fg(Color::Yellow)),
        ]),
        Line::from(""),
    ];
    if fields.is_empty() {
        lines.push(Line::from(Span::styled(
            " Press Enter to confirm, Esc to cancel ",
            Style::default().fg(Color::Cyan),
        )));
    } else {
        for (i, &label) in fields.iter().enumerate() {
            let val = values.get(i).map(|s| s.as_str()).unwrap_or("");
            let cursor = if i == field_idx { "▌" } else { "" };
            lines.push(Line::from(vec![
                Span::styled(format!("  {}: ", label), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("{}{}", val, cursor), Style::default().fg(Color::White)),
            ]));
            lines.push(Line::from(""));
        }
        lines.push(Line::from(Span::styled(
            " Tab/Enter: next field or submit  Esc: cancel ",
            Style::default().fg(Color::DarkGray),
        )));
    }
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Cyan))
        .title(Span::styled(format!(" {} ", title), Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));
    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: true }), area);
}

fn draw_operations(f: &mut Frame, state: &TuiState, area: ratatui::layout::Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Operations ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));

    let header = Row::new(vec![
        Cell::from("  #").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        Cell::from("Action").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
    ])
    .height(1)
    .bottom_margin(1);

    let rows: Vec<Row> = Op::ALL
        .iter()
        .enumerate()
        .map(|(i, op)| {
            let is_selected = i == state.selected_index;
            let row_style = if is_selected {
                Style::default().add_modifier(Modifier::BOLD).bg(Color::DarkGray)
            } else {
                Style::default()
            };
            Row::new(vec![
                Cell::from(format!("  {}", i + 1)).style(Style::default().fg(Color::DarkGray)),
                Cell::from(op.title()).style(Style::default().fg(Color::White)),
            ])
            .style(row_style)
            .height(1)
        })
        .collect();

    let table = Table::new(rows, [Constraint::Length(6), Constraint::Min(30)])
        .header(header)
        .block(block);
    f.render_widget(table, area);
}

fn draw_compliance(f: &mut Frame, state: &TuiState, area: ratatui::layout::Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Compliance ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));

    let header = Row::new(vec![
        Cell::from("  #").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        Cell::from("Action").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
    ])
    .height(1)
    .bottom_margin(1);

    let rows: Vec<Row> = ComplianceOp::ALL
        .iter()
        .enumerate()
        .map(|(i, op)| {
            let is_selected = i == state.selected_index;
            let row_style = if is_selected {
                Style::default().add_modifier(Modifier::BOLD).bg(Color::DarkGray)
            } else {
                Style::default()
            };
            Row::new(vec![
                Cell::from(format!("  {}", i + 1)).style(Style::default().fg(Color::DarkGray)),
                Cell::from(op.title()).style(Style::default().fg(Color::White)),
            ])
            .style(row_style)
            .height(1)
        })
        .collect();

    let table = Table::new(rows, [Constraint::Length(6), Constraint::Min(30)])
        .header(header)
        .block(block);
    f.render_widget(table, area);
}

fn draw_blacklist(f: &mut Frame, area: ratatui::layout::Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(7), Constraint::Min(0)])
        .split(area);

    let info_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Blacklist Check ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));
    let info_lines = vec![
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Check whether an address is blacklisted (SSS-2, SSS-4).",
            Style::default().fg(Color::White),
        )]),
        Line::from(""),
        Line::from(vec![
            Span::styled("  Seeds: ", Style::default().fg(Color::DarkGray)),
            Span::styled("[\"blacklist\", mint, address]", Style::default().fg(Color::Yellow)),
        ]),
    ];
    f.render_widget(Paragraph::new(info_lines).block(info_block), chunks[0]);

    let placeholder_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray))
        .title(Span::styled(" Address Lookup ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));
    let placeholder_lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            "  [Interactive input coming in a future update]",
            Style::default().fg(Color::DarkGray),
        )),
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Use the CLI: sss-token blacklist check --mint <MINT> <ADDRESS>",
            Style::default().fg(Color::Green),
        )]),
    ];
    f.render_widget(
        Paragraph::new(placeholder_lines).block(placeholder_block),
        chunks[1],
    );
}

fn draw_events(f: &mut Frame, state: &TuiState, area: ratatui::layout::Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Event Log ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));

    if state.events.is_empty() {
        let rows = vec![Row::new(vec![Cell::from(""), Cell::from("No events yet.")])
            .style(Style::default().fg(Color::DarkGray))];
        let table = Table::new(rows, [Constraint::Length(12), Constraint::Min(40)]).block(block);
        f.render_widget(table, area);
        return;
    }

    let header = Row::new(vec![
        Cell::from("  Time").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        Cell::from("Event").style(Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
    ])
    .height(1)
    .bottom_margin(1);

    let rows: Vec<Row> = state
        .events
        .iter()
        .rev()
        .enumerate()
        .map(|(i, event)| {
            let is_selected = i == state.selected_index;
            let msg_color = if event.message.starts_with("Error") {
                Color::Red
            } else if event.message.contains("refreshed") {
                Color::Green
            } else {
                Color::White
            };
            let row_style = if is_selected {
                Style::default().add_modifier(Modifier::BOLD).bg(Color::DarkGray)
            } else {
                Style::default()
            };
            Row::new(vec![
                Cell::from(format!("  {}", event.timestamp)).style(Style::default().fg(Color::DarkGray)),
                Cell::from(event.message.as_str()).style(Style::default().fg(msg_color)),
            ])
            .style(row_style)
            .height(1)
        })
        .collect();

    let table = Table::new(rows, [Constraint::Length(12), Constraint::Min(40)])
        .header(header)
        .block(block);
    f.render_widget(table, area);
}

fn draw_fees(f: &mut Frame, state: &TuiState, area: ratatui::layout::Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Blue))
        .title(Span::styled(" Fees (SSS-4) ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)));

    let Some(ref cfg) = state.config_data else {
        let p = Paragraph::new("No data. Press 'r' to refresh.")
            .block(block)
            .wrap(Wrap { trim: true });
        f.render_widget(p, area);
        return;
    };

    if cfg.preset != 4 {
        let lines = vec![
            Line::from(""),
            Line::from(Span::styled(
                format!("  Transfer fees are SSS-4 only. This mint is preset {}.", cfg.preset),
                Style::default().fg(Color::Yellow),
            )),
        ];
        let p = Paragraph::new(lines).block(block).wrap(Wrap { trim: true });
        f.render_widget(p, area);
        return;
    }

    let lines = vec![
        Line::from(""),
        Line::from(vec![
            Span::styled("  Transfer Fee: ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                format!("{} bps", cfg.transfer_fee_basis_points),
                Style::default().fg(Color::Cyan),
            ),
        ]),
        Line::from(vec![
            Span::styled("  Max Fee:     ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                format_amount(cfg.maximum_fee, cfg.decimals),
                Style::default().fg(Color::Cyan),
            ),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("  Withdraw withheld: ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                format!("sss-token fees withdraw --mint {} --destination <ATA>", cfg.mint),
                Style::default().fg(Color::Green),
            ),
        ]),
    ];
    let p = Paragraph::new(lines).block(block).wrap(Wrap { trim: true });
    f.render_widget(p, area);
}

fn short_key(pk: &Pubkey) -> String {
    let s = pk.to_string();
    if s.len() > 12 {
        format!("{}...{}", &s[..6], &s[s.len() - 4..])
    } else {
        s
    }
}

fn short_key_str(s: &str) -> String {
    if s.len() > 12 {
        format!("{}...{}", &s[..6], &s[s.len() - 4..])
    } else {
        s.to_string()
    }
}
