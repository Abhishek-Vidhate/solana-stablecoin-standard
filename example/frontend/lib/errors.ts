export function parseProgramError(errorStr: string): string {
  if (!errorStr) return "An unknown error occurred";

  // Check for common Anchor Error patterns
  // Pattern: "Error Message: [Message]"
  const anchorMsgMatch = errorStr.match(/Error Message: (.*?)\./);
  if (anchorMsgMatch && anchorMsgMatch[1]) {
    return anchorMsgMatch[1];
  }

  // Pattern: "Program log: AnchorError thrown in ... Error Message: [Message]"
  const logMatch = errorStr.match(/Error Message: (.*?)(?:\",|\]|$)/);
  if (logMatch && logMatch[1]) {
    return logMatch[1].trim();
  }

  // Specific common cases
  if (errorStr.includes("0x1773")) {
    // This is the custom error code from the screenshot (Unauthorized: not a blacklister)
    if (errorStr.includes("not a blacklister")) return "Unauthorized: not a blacklister";
    if (errorStr.includes("not a minter")) return "Unauthorized: not a minter";
    return "Unauthorized: missing required role";
  }

  if (errorStr.includes("ConstraintSeeds")) {
    return "Security error: invalid account seeds (unauthorized or wrong configuration)";
  }

  if (errorStr.includes("InvalidAccountData")) {
    return "Failed to parse account data. Ensure the mint/address is correct.";
  }

  if (errorStr.includes("AccountNotInitialized")) {
    return "The requested account or stablecoin is not initialized.";
  }

  // Fallback to a cleaner version of the raw message
  // Remove "Simulation failed. Message: Transaction simulation failed: " prefix if present
  let clean = errorStr.replace(/Simulation failed\. Message: Transaction simulation failed: /i, "");
  
  // If it's still very long and technical, return a generic but helpful message
  if (clean.length > 150 && clean.includes("Program log:")) {
    return "Transaction failed. Please check if you have the required permissions.";
  }

  return clean;
}
