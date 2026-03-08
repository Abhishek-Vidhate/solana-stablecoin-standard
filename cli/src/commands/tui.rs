//! Terminal UI for live monitoring. Tabs: Dashboard, Config.
//! Press Tab to switch, q to quit.
use anyhow::Result;
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame, Terminal,
};
use std::io;
use std::time::Duration;

use crate::config::CliContext;
use crate::utils::*;

enum Tab {
    Dashboard,
    Config,
}

pub fn run(ctx: &CliContext, mint_arg: Option<&str>) -> Result<()> {
    let mut mint_str = mint_arg.map(String::from).unwrap_or_default();
    let editable = mint_arg.is_none();

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut tab = Tab::Dashboard;
    let mut last_error: Option<String> = None;

    loop {
        terminal.draw(|f| ui(f, ctx, &mint_str, &tab, &last_error, editable))?;

        if event::poll(Duration::from_millis(500))? {
            if let Event::Key(key) = event::read()? {
                if key.kind != KeyEventKind::Press {
                    continue;
                }
                match key.code {
                    KeyCode::Char('q') => break,
                    KeyCode::Tab => {
                        tab = match tab {
                            Tab::Dashboard => Tab::Config,
                            Tab::Config => Tab::Dashboard,
                        };
                    }
                    KeyCode::Char(c) if editable && c != 'q' => {
                        mint_str.push(c);
                    }
                    KeyCode::Backspace if editable => {
                        mint_str.pop();
                    }
                    KeyCode::Enter if mint_str.is_empty() => {}
                    KeyCode::Enter => {
                        last_error = None;
                    }
                    _ => {}
                }
            }
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    Ok(())
}

fn ui(
    f: &mut Frame,
    ctx: &CliContext,
    mint_str: &str,
    tab: &Tab,
    _last_error: &Option<String>,
    editable: bool,
) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .split(f.area());

    let title = match tab {
        Tab::Dashboard => "Dashboard",
        Tab::Config => "Config",
    };

    let header = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("SSS TUI ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw("| Tab: switch | q: quit"),
        ]),
        Line::from(Span::raw(format!("Mint: {}", if mint_str.is_empty() { "(enter mint address)" } else { mint_str }))),
    ])
    .block(Block::default().borders(Borders::BOTTOM).title(title));

    f.render_widget(header, chunks[0]);

    let content = if mint_str.is_empty() {
        let msg = if editable {
            "Type mint address (base58, 32-44 chars) then Tab to switch views. q to quit."
        } else {
            "No mint provided. Run with --mint <ADDRESS> to monitor."
        };
        Paragraph::new(msg)
            .block(Block::default().borders(Borders::ALL).title("Info"))
            .wrap(Wrap { trim: true })
    } else if parse_pubkey(mint_str).is_err() {
        Paragraph::new("Enter a valid base58 mint address (32-44 chars).")
            .block(Block::default().borders(Borders::ALL).title("Info"))
            .wrap(Wrap { trim: true })
    } else {
        match fetch_config_display(ctx, mint_str) {
            Ok(text) => Paragraph::new(text)
                .block(Block::default().borders(Borders::ALL).title("Config"))
                .wrap(Wrap { trim: true }),
            Err(e) => Paragraph::new(e.to_string())
                .block(Block::default().borders(Borders::ALL).title("Error"))
                .wrap(Wrap { trim: true }),
        }
    };

    f.render_widget(content, chunks[1]);
}

fn fetch_config_display(ctx: &CliContext, mint_str: &str) -> Result<Vec<Line<'static>>> {
    let mint = parse_pubkey(mint_str)?;
    let (config_pda, _) = derive_config_pda(&mint);

    let account = ctx
        .client
        .get_account(&config_pda)
        .map_err(|e| anyhow::anyhow!("Failed to fetch config: {e}"))?;

    let cfg = parse_config_account(&account.data)?;

    let supply = cfg.current_supply();
    let supply_str = format_amount(supply, cfg.decimals);

    Ok(vec![
        Line::from(vec![
            Span::styled("Name: ", Style::default().fg(Color::Yellow)),
            Span::raw(cfg.name.clone()),
        ]),
        Line::from(vec![
            Span::styled("Symbol: ", Style::default().fg(Color::Yellow)),
            Span::raw(cfg.symbol.clone()),
        ]),
        Line::from(vec![
            Span::styled("Preset: ", Style::default().fg(Color::Yellow)),
            Span::raw(preset_name(cfg.preset).to_string()),
        ]),
        Line::from(vec![
            Span::styled("Supply: ", Style::default().fg(Color::Yellow)),
            Span::raw(supply_str),
        ]),
        Line::from(vec![
            Span::styled("Paused: ", Style::default().fg(Color::Yellow)),
            Span::raw(if cfg.paused { "Yes".to_string() } else { "No".to_string() }),
        ]),
    ])
}
