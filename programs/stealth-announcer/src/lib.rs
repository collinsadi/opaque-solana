use anchor_lang::prelude::*;

declare_id!("HGFn2fH7bVQ5cSuiG52NjzN9m11YrB3FZUfoN9b9A5jf");

/// Stealth Address Announcer — emits Announcement events when something is sent
/// to a stealth address. Equivalent to ERC-5564 on Ethereum.
/// One deployment per cluster so scanners can subscribe to a single log source.
///
/// schemeId 1 = secp256k1 with view tags. metadata[0] = view tag byte;
/// remaining bytes can carry encrypted payment IDs or attestation data.
#[program]
pub mod stealth_announcer {
    use super::*;

    /// Emit an announcement so the recipient's scanner can detect the transfer.
    ///
    /// * `scheme_id` — Stealth scheme (1 = secp256k1).
    /// * `stealth_address` — The one-time stealth address (as 20-byte Ethereum-compatible
    ///   address or 32-byte Solana pubkey, stored as bytes for cross-chain flexibility).
    /// * `ephemeral_pub_key` — Compressed secp256k1 ephemeral public key (33 bytes).
    /// * `metadata` — First byte MUST be the view tag; rest is optional.
    pub fn announce(
        ctx: Context<Announce>,
        scheme_id: u64,
        stealth_address: Vec<u8>,
        ephemeral_pub_key: Vec<u8>,
        metadata: Vec<u8>,
    ) -> Result<()> {
        require!(
            ephemeral_pub_key.len() == 33,
            AnnouncerError::InvalidEphemeralKey
        );
        require!(!metadata.is_empty(), AnnouncerError::MetadataMissingViewTag);

        emit!(Announcement {
            scheme_id,
            stealth_address,
            caller: ctx.accounts.caller.key(),
            ephemeral_pub_key,
            metadata,
        });

        Ok(())
    }

    /// Announce with an on-chain log record for indexing.
    /// Creates a small PDA so indexers can use getProgramAccounts queries
    /// in addition to parsing transaction logs.
    ///
    /// `log_id` — unique 32-byte id for this log PDA (e.g. random bytes or a hash of payload + nonce).
    pub fn announce_with_log(
        ctx: Context<AnnounceWithLog>,
        scheme_id: u64,
        stealth_address: Vec<u8>,
        ephemeral_pub_key: Vec<u8>,
        metadata: Vec<u8>,
        log_id: [u8; 32],
    ) -> Result<()> {
        require!(
            ephemeral_pub_key.len() == 33,
            AnnouncerError::InvalidEphemeralKey
        );
        require!(!metadata.is_empty(), AnnouncerError::MetadataMissingViewTag);

        let log = &mut ctx.accounts.announcement_log;
        log.scheme_id = scheme_id;
        log.stealth_address = stealth_address.clone();
        log.caller = ctx.accounts.caller.key();
        log.ephemeral_pub_key = ephemeral_pub_key.clone();
        log.metadata = metadata.clone();
        log.slot = Clock::get()?.slot;
        log.log_id = log_id;
        log.bump = ctx.bumps.announcement_log;

        emit!(Announcement {
            scheme_id,
            stealth_address,
            caller: ctx.accounts.caller.key(),
            ephemeral_pub_key,
            metadata,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Announce<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(
    scheme_id: u64,
    stealth_address: Vec<u8>,
    ephemeral_pub_key: Vec<u8>,
    metadata: Vec<u8>,
    log_id: [u8; 32],
)]
pub struct AnnounceWithLog<'info> {
    #[account(
        init,
        payer = caller,
        space = AnnouncementLog::space(&stealth_address, &ephemeral_pub_key, &metadata),
        seeds = [b"announcement", caller.key().as_ref(), log_id.as_ref()],
        bump,
    )]
    pub announcement_log: Account<'info, AnnouncementLog>,

    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
pub struct AnnouncementLog {
    pub scheme_id: u64,
    pub stealth_address: Vec<u8>,
    pub caller: Pubkey,
    pub ephemeral_pub_key: Vec<u8>,
    pub metadata: Vec<u8>,
    pub slot: u64,
    pub log_id: [u8; 32],
    pub bump: u8,
}

impl AnnouncementLog {
    pub fn space(
        stealth_address: &[u8],
        ephemeral_pub_key: &[u8],
        metadata: &[u8],
    ) -> usize {
        8  // discriminator
        + 8  // scheme_id
        + 4 + stealth_address.len() // stealth_address vec
        + 32 // caller
        + 4 + ephemeral_pub_key.len() // ephemeral_pub_key vec
        + 4 + metadata.len() // metadata vec
        + 8  // slot
        + 32 // log_id
        + 1  // bump
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct Announcement {
    pub scheme_id: u64,
    pub stealth_address: Vec<u8>,
    pub caller: Pubkey,
    pub ephemeral_pub_key: Vec<u8>,
    pub metadata: Vec<u8>,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum AnnouncerError {
    #[msg("Ephemeral public key must be exactly 33 bytes (compressed secp256k1)")]
    InvalidEphemeralKey,
    #[msg("Metadata must contain at least the view tag byte")]
    MetadataMissingViewTag,
}
