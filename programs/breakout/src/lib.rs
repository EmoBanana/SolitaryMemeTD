use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, program::invoke_signed, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, transfer, mint_to, burn},
};
use mpl_token_metadata::{
    instructions::{CreateMetadataAccountV3, CreateMasterEditionV3},
    ID as MetadataID,
};
use switchboard_v2::{VrfAccountData, VrfRequestRandomness};

// Import specific types from mpl_token_metadata
use mpl_token_metadata::types::{Creator, DataV2};

declare_id!("CC4F6JLXNuPQfBEXbPifoMjW4FX8kJVxgZLqz8U9y5nw");

pub const SHARD_TOKEN_ADDRESS: &str = "B3G9uhi7euWErYvwfTye2MpDJytkYX6mAgUhErHbnSoT";
pub const TREASURY_ADDRESS: &str = "9yqmoJ4ekXvTPQDCj7zQS36ar2fMb1fTx1FA2xovfZjR";
// Fee payer address (same as treasury)
pub const FEE_PAYER_ADDRESS: &str = "9yqmoJ4ekXvTPQDCj7zQS36ar2fMb1fTx1FA2xovfZjR";
pub const PLATFORM_FEE_PERCENTAGE: u8 = 5; // 5%
pub const TOKEN_REWARD_INTERVAL: i64 = 15; // 15 seconds
pub const TOWER_SEED: &[u8] = b"tower";
pub const USER_STATS_SEED: &[u8] = b"user_stats";
pub const GAME_POOL_SEED: &[u8] = b"game_pool";
pub const VRF_STATE_SEED: &[u8] = b"vrf_state";
pub const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";
pub const GAME_SERVER_SEED: &[u8] = b"game_server";
pub const FEE_PAYER_SEED: &[u8] = b"fee_payer";
pub const SHARDS_PER_SOL: u64 = 1000; // 1000 shards per SOL
pub const TOWER_COST_BASIC: u64 = 100;
pub const TOWER_COST_UPGRADE: u64 = 1000; // Changed from 200 to 1000
pub const XP_PER_LEVEL: u64 = 100; // Changed from 1000 to 100
pub const LOOTBOX_COST: u64 = 3000; // Changed from 300 to 3000
pub const MIN_LEVEL_FOR_EVOLUTION: u8 = 10; // New constant: require level 10 for evolution
pub const XP_PER_MINUTE: u64 = 1; // New constant: 1 XP per minute of gameplay
pub const SECONDS_PER_MINUTE: i64 = 60; // New constant: seconds to minute conversion

// Tower upgrade constants
pub const DAMAGE_UPGRADE_BASE_COST: u64 = 20;
pub const DAMAGE_UPGRADE_COST_INCREMENT: u64 = 15;
pub const DAMAGE_UPGRADE_VALUE: u16 = 4;

pub const ATTACK_SPEED_UPGRADE_BASE_COST: u64 = 20;
pub const ATTACK_SPEED_UPGRADE_COST_INCREMENT: u64 = 20;
pub const ATTACK_SPEED_UPGRADE_VALUE: u16 = 1; // Will be divided by 10 to get 0.1

pub const RANGE_UPGRADE_BASE_COST: u64 = 30;
pub const RANGE_UPGRADE_COST_INCREMENT: u64 = 30;
pub const RANGE_UPGRADE_VALUE: u16 = 1; // Will be divided by 10 to get 0.1

pub const HEALTH_UPGRADE_BASE_COST: u64 = 20;
pub const HEALTH_UPGRADE_COST_INCREMENT: u64 = 20;
pub const HEALTH_UPGRADE_VALUE: u16 = 1;

pub const HEALTH_REGEN_UPGRADE_BASE_COST: u64 = 15;
pub const HEALTH_REGEN_UPGRADE_COST_INCREMENT: u64 = 15;
pub const HEALTH_REGEN_UPGRADE_VALUE: u16 = 1; // Will be divided by 100 to get 0.01

// Tower stats tracking
#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub struct TowerUpgrades {
    pub damage_level: u16,
    pub attack_speed_level: u16,
    pub range_level: u16,
    pub health_level: u16,
    pub health_regen_level: u16,
}

// Helper function to calculate upgrade cost based on current level
pub fn calculate_upgrade_cost(base_cost: u64, increment: u64, current_level: u16) -> u64 {
    base_cost + (increment * current_level as u64)
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid tower type")]
    InvalidTowerType,
    #[msg("Cannot evolve legendary tower")]
    CannotEvolve,
    #[msg("Randomness already used")]
    RandomnessAlreadyUsed,
    #[msg("Game is already completed")]
    GameAlreadyCompleted,
    #[msg("Invalid player")]
    InvalidPlayer,
    #[msg("Game not completed")]
    GameNotCompleted,
    #[msg("Insufficient level")]
    InsufficientLevel,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid tower")]
    InvalidTower,
    #[msg("Game already started")]
    GameAlreadyStarted,
    #[msg("Player already joined")]
    PlayerAlreadyJoined,
    #[msg("Invalid winner")]
    InvalidWinner,
    #[msg("Insufficient players")]
    InsufficientPlayers,
    #[msg("Cannot close game pool during payout")]
    CannotCloseGamePoolDuringPayout,
    #[msg("Starter tower already claimed")]
    StarterTowerAlreadyClaimed,
}

#[program]
pub mod breakout {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Initializing SolitaryMemeTD game");
        Ok(())
    }

    pub fn initialize_user_stats(ctx: Context<InitializeUserStats>) -> Result<()> {
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.owner = ctx.accounts.user.key();
        user_stats.total_games_played = 0;
        user_stats.total_wins = 0;
        user_stats.total_shards_earned = 0;
        user_stats.total_shards_spent = 0;
        user_stats.total_towers_owned = 0;
        user_stats.has_claimed_starter_tower = false;
        user_stats.bump = *ctx.bumps.get("user_stats").unwrap();
        
        Ok(())
    }

    pub fn mint_shards(ctx: Context<MintShards>, amount: u64) -> Result<()> {
        // PDA authority check is sufficient
        
        // Find the PDA for mint authority
        let (mint_auth_pda, bump) = Pubkey::find_program_address(
            &[MINT_AUTHORITY_SEED, ctx.accounts.mint.key().as_ref()],
            ctx.program_id
        );
        
        // Verify authority is the expected PDA
        require!(ctx.accounts.mint_authority.key() == mint_auth_pda, ErrorCode::Unauthorized);
        
        // Sign with the PDA
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.mint.key().as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_earned = user_stats.total_shards_earned.checked_add(amount).unwrap();
        
        Ok(())
    }
    
    pub fn buy_shards(ctx: Context<BuyShards>, amount_sol: u64) -> Result<()> {
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.treasury.key(),
            amount_sol,
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        let token_amount = amount_sol.checked_mul(SHARDS_PER_SOL).unwrap();
        
        // Find the PDA for mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.mint.key().as_ref(),
            &[ctx.bumps.get("mint_authority").unwrap()],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            token_amount,
        )?;
        
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_earned = user_stats.total_shards_earned.checked_add(token_amount).unwrap();
        
        Ok(())
    }
    
    pub fn burn_shards(ctx: Context<BurnShards>, amount: u64) -> Result<()> {
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;
        
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(amount).unwrap();
        
        Ok(())
    }

    pub fn mint_tower(ctx: Context<MintTower>, uri: String, name: String) -> Result<()> {
        // All towers are the same tier now, so tower_type is always 0
        let tower_type = 0;
        
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            TOWER_COST_BASIC,
        )?;
        
        // Find the PDA for tower mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.tower_mint.key().as_ref(),
            &[ctx.bumps.get("tower_mint_authority").unwrap()],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.tower_mint.to_account_info(),
                    to: ctx.accounts.tower_token_account.to_account_info(),
                    authority: ctx.accounts.tower_mint_authority.to_account_info(),
                },
                signer,
            ),
            1,
        )?;
        
        let creator = vec![
            Creator {
                address: ctx.accounts.user.key(),
                verified: false,
                share: 100,
            },
        ];
        
        let symbol = "TOWER";
        
        let data = DataV2 {
            name: name,
            symbol: symbol.to_string(),
            uri: uri,
            seller_fee_basis_points: 500, // 5% royalty fee
            creators: Some(creator),
            collection: None,
            uses: None,
        };
        
        // Fix first metadata instance
        let ix = CreateMetadataAccountV3::instruction(
            &CreateMetadataAccountV3 {
                metadata: ctx.accounts.metadata.key(),
                mint: ctx.accounts.tower_mint.key(),
                mint_authority: ctx.accounts.user.key(),
                payer: ctx.accounts.user.key(),
                update_authority: (ctx.accounts.user.key(), true),
                system_program: ctx.accounts.system_program.key(),
                rent: Some(ctx.accounts.rent.key()),
            },
            mpl_token_metadata::instructions::CreateMetadataAccountV3InstructionArgs {
                data,
                is_mutable: true,
                collection_details: None,
            },
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.tower_mint.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
        
        let master_edition_infos = [
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.tower_mint.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        
        // Fix first master edition instance
        invoke(
            &CreateMasterEditionV3::instruction(
                &CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.key(),
                    mint: ctx.accounts.tower_mint.key(),
                    update_authority: ctx.accounts.user.key(),
                    mint_authority: ctx.accounts.user.key(),
                    payer: ctx.accounts.user.key(),
                    metadata: ctx.accounts.metadata.key(),
                    token_program: ctx.accounts.token_program.key(),
                    system_program: ctx.accounts.system_program.key(),
                    rent: Some(ctx.accounts.rent.key()),
                },
                mpl_token_metadata::instructions::CreateMasterEditionV3InstructionArgs {
                    max_supply: Some(0),
                },
            ),
            &master_edition_infos,
        )?;
        
        let tower = &mut ctx.accounts.tower;
        tower.owner = ctx.accounts.user.key();
        tower.mint = ctx.accounts.tower_mint.key();
        tower.tower_type = tower_type;
        tower.level = 1;
        tower.xp = 0;
        tower.attack = 10; // Fixed value for all towers
        tower.defense = 5;  // Fixed value for all towers
        tower.range = 2;    // Fixed value for all towers
        tower.speed = 1;    // Fixed value for all towers
        tower.damage_level = 0;
        tower.attack_speed_level = 0;
        tower.range_level = 0;
        tower.health_level = 0;
        tower.health_regen_level = 0;
        tower.bump = *ctx.bumps.get("tower").unwrap();
        
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_towers_owned = user_stats.total_towers_owned.checked_add(1).unwrap();
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(TOWER_COST_BASIC).unwrap();
        
        Ok(())
    }
    
    pub fn add_tower_xp(ctx: Context<UpdateTower>, xp_amount: u64) -> Result<()> {
        require!(ctx.accounts.user.key() == ctx.accounts.tower.owner, ErrorCode::Unauthorized);
        
        let tower = &mut ctx.accounts.tower;
        let current_xp = tower.xp;
        let current_level = tower.level;
        
        tower.xp = tower.xp.checked_add(xp_amount).unwrap();
        
        let new_level = (tower.xp / XP_PER_LEVEL).checked_add(1).unwrap() as u8;
        
        if new_level > current_level {
            tower.level = new_level;
            
            // Fixed multiplier based on level - all towers have the same base stats now
            tower.attack = 10u16.checked_mul(new_level as u16).unwrap();
            tower.defense = 5u16.checked_mul(new_level as u16).unwrap();
            tower.range = 2u16.checked_add((new_level as u16) / 2).unwrap();
            tower.speed = 1u16.checked_add((new_level as u16) / 3).unwrap();
        }
        
        Ok(())
    }
    
    pub fn evolve_tower(ctx: Context<EvolveTower>, uri: String, name: String) -> Result<()> {
        // Check if tower has reached minimum level for evolution
        require!(ctx.accounts.old_tower.level >= MIN_LEVEL_FOR_EVOLUTION, ErrorCode::InsufficientLevel);
        
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            TOWER_COST_UPGRADE,
        )?;
        
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.old_tower_mint.to_account_info(),
                    from: ctx.accounts.old_tower_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            1,
        )?;
        
        // All towers are the same tier, so we don't change the tower_type
        let new_tower_type = ctx.accounts.old_tower.tower_type;
        
        // Find the PDA for tower mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.new_tower_mint.key().as_ref(),
            &[ctx.bumps.get("new_tower_mint_authority").unwrap()],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.new_tower_mint.to_account_info(),
                    to: ctx.accounts.new_tower_token_account.to_account_info(),
                    authority: ctx.accounts.new_tower_mint_authority.to_account_info(),
                },
                signer,
            ),
            1,
        )?;
        
        let creator = vec![
            Creator {
                address: ctx.accounts.user.key(),
                verified: false,
                share: 100,
            },
        ];
        
        let symbol = "TOWER";
        
        let data = DataV2 {
            name: name,
            symbol: symbol.to_string(),
            uri: uri,
            seller_fee_basis_points: 500, // 5% royalty fee
            creators: Some(creator),
            collection: None,
            uses: None,
        };
        
        let accounts = CreateMetadataAccountV3 {
            metadata: ctx.accounts.metadata.key(),
            mint: ctx.accounts.new_tower_mint.key(),
            mint_authority: ctx.accounts.user.key(),
            payer: ctx.accounts.user.key(),
            update_authority: (ctx.accounts.user.key(), true),
            system_program: ctx.accounts.system_program.key(),
            rent: Some(ctx.accounts.rent.key()),
        };
        
        let ix = CreateMetadataAccountV3::instruction(
            &accounts,
            mpl_token_metadata::instructions::CreateMetadataAccountV3InstructionArgs {
                data,
                is_mutable: true,
                collection_details: None,
            },
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.new_tower_mint.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
        
        let master_edition_infos = [
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.new_tower_mint.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        
        invoke(
            &CreateMasterEditionV3::instruction(
                &CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.key(),
                    mint: ctx.accounts.new_tower_mint.key(),
                    update_authority: ctx.accounts.user.key(),
                    mint_authority: ctx.accounts.user.key(),
                    payer: ctx.accounts.user.key(),
                    metadata: ctx.accounts.metadata.key(),
                    token_program: ctx.accounts.token_program.key(),
                    system_program: ctx.accounts.system_program.key(),
                    rent: Some(ctx.accounts.rent.key()),
                },
                mpl_token_metadata::instructions::CreateMasterEditionV3InstructionArgs {
                    max_supply: Some(0),
                },
            ),
            &master_edition_infos,
        )?;
        
        let tower = &mut ctx.accounts.new_tower;
        tower.owner = ctx.accounts.user.key();
        tower.mint = ctx.accounts.new_tower_mint.key();
        tower.tower_type = new_tower_type;
        tower.level = 1;
        tower.xp = 0;
        tower.attack = 10; // Fixed value for all towers
        tower.defense = 5;  // Fixed value for all towers
        tower.range = 2;    // Fixed value for all towers
        tower.speed = 1;    // Fixed value for all towers
        
        // Transfer upgrade levels from old tower to new tower
        tower.damage_level = ctx.accounts.old_tower.damage_level;
        tower.attack_speed_level = ctx.accounts.old_tower.attack_speed_level;
        tower.range_level = ctx.accounts.old_tower.range_level;
        tower.health_level = ctx.accounts.old_tower.health_level;
        tower.health_regen_level = ctx.accounts.old_tower.health_regen_level;
        
        tower.bump = *ctx.bumps.get("new_tower").unwrap();
        
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(TOWER_COST_UPGRADE).unwrap();
        
        Ok(())
    }

    pub fn initialize_vrf_client(ctx: Context<InitializeVrfClient>) -> Result<()> {
        let vrf_state = &mut ctx.accounts.vrf_state;
        vrf_state.vrf = ctx.accounts.vrf.key();
        vrf_state.authority = ctx.accounts.user.key();
        vrf_state.result_used = true; // Start with result used
        vrf_state.bump = *ctx.bumps.get("vrf_state").unwrap();
        
        Ok(())
    }
    
    pub fn request_randomness(ctx: Context<RequestRandomness>) -> Result<()> {
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            LOOTBOX_COST,
        )?;
        
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(LOOTBOX_COST).unwrap();
        
        let vrf_state = &mut ctx.accounts.vrf_state;
        vrf_state.result_used = false;
        
        let switchboard_program = ctx.accounts.switchboard_program.to_account_info();
        let vrf_account = ctx.accounts.vrf.to_account_info();
        let user = ctx.accounts.user.to_account_info();
        
        let request_randomness_ix = VrfRequestRandomness {
            authority:        ctx.accounts.vrf_state.to_account_info(),
            vrf:              vrf_account.clone(),
            oracle_queue:     ctx.accounts.oracle_queue.to_account_info(),
            queue_authority:  ctx.accounts.queue_authority.to_account_info(),
            data_buffer:      ctx.accounts.data_buffer.to_account_info(),
            permission:       ctx.accounts.permission.to_account_info(),
            escrow:           ctx.accounts.escrow.clone(),          // TokenAccount
            payer_wallet:     ctx.accounts.payer_wallet.clone(),    // TokenAccount
            payer_authority:  ctx.accounts.payer_authority.to_account_info(),
            recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
            program_state:    ctx.accounts.program_state.to_account_info(),
            token_program:    ctx.accounts.token_program.to_account_info(),
        };
        
        let vrf_state_seeds = &[
            VRF_STATE_SEED,
            ctx.accounts.user.key().as_ref(),
            &[vrf_state.bump],
        ];
        let signer = &[&vrf_state_seeds[..]];
        
        request_randomness_ix.invoke_signed(
            switchboard_program,
            signer,
        )?;
        
        Ok(())
    }
    
    pub fn open_lootbox(ctx: Context<OpenLootbox>, uri: String, name: String) -> Result<()> {
        let vrf_state = &mut ctx.accounts.vrf_state;
        
        require!(!vrf_state.result_used, ErrorCode::RandomnessAlreadyUsed);
        
        let vrf_account_info = ctx.accounts.vrf.to_account_info();
        let vrf = VrfAccountData::new(&vrf_account_info)?;
        let result = vrf.get_result()?;
        
        vrf_state.result_buffer = result;
        vrf_state.result_used = true;
        
        // All towers are the same tier now, so tower_type is always 0
        let tower_type = 0;
        
        // Find the PDA for tower mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.tower_mint.key().as_ref(),
            &[ctx.bumps.get("tower_mint_authority").unwrap()],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.tower_mint.to_account_info(),
                    to: ctx.accounts.tower_token_account.to_account_info(),
                    authority: ctx.accounts.tower_mint_authority.to_account_info(),
                },
                signer,
            ),
            1,
        )?;
        
        let creator = vec![
            Creator {
                address: ctx.accounts.user.key(),
                verified: false,
                share: 100,
            },
        ];
        
        let symbol = "TOWER";
        
        let data = DataV2 {
            name: name,
            symbol: symbol.to_string(),
            uri: uri,
            seller_fee_basis_points: 500, // 5% royalty fee
            creators: Some(creator),
            collection: None,
            uses: None,
        };
        
        let accounts = CreateMetadataAccountV3 {
            metadata: ctx.accounts.metadata.key(),
            mint: ctx.accounts.tower_mint.key(),
            mint_authority: ctx.accounts.user.key(),
            payer: ctx.accounts.user.key(),
            update_authority: (ctx.accounts.user.key(), true),
            system_program: ctx.accounts.system_program.key(),
            rent: Some(ctx.accounts.rent.key()),
        };
        
        let ix = CreateMetadataAccountV3::instruction(
            &accounts,
            data,
            true,
            true,
            None,
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.tower_mint.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
        
        let master_edition_infos = [
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.tower_mint.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        
        invoke(
            &CreateMasterEditionV3::instruction(
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.key(),
                    mint: ctx.accounts.tower_mint.key(),
                    update_authority: ctx.accounts.user.key(),
                    mint_authority: ctx.accounts.user.key(),
                    payer: ctx.accounts.user.key(),
                    metadata: ctx.accounts.metadata.key(),
                    token_program: ctx.accounts.token_program.key(),
                    system_program: ctx.accounts.system_program.key(),
                    rent: Some(ctx.accounts.rent.key()),
                },
                Some(0),
            ),
            &master_edition_infos,
        )?;
        
        // Use VRF randomness to generate tower stats
        // Reference base stats from Game.tsx:
        // - Damage: 20 (attack)
        // - Range: 3
        // - FireRate: 1200 (speed)
        // - HP: 10 (defense)
        
        // Use different bytes from the randomness result for each stat
        // Scale the random bytes to get balanced stats
        let random_bytes = &vrf_state.result_buffer;
        
        // Calculate random attack (damage) between 22-30
        let attack_rand = (random_bytes[0] as u16) % 9 + 22;
        
        // Calculate random defense (health) between 12-18
        let defense_rand = (random_bytes[1] as u16) % 7 + 12;
        
        // Calculate random range between 3.2-3.6
        let range_rand = (random_bytes[2] as u16) % 5 + 32;
        let range_rand = range_rand / 10; // Scale to get 3.2-3.6 (stored as 32-36)
        
        // Calculate random speed (fire rate) between 1.2-1.8
        let speed_rand = (random_bytes[3] as u16) % 7 + 12;
        let speed_rand = speed_rand / 10; // Scale to get 1.2-1.8 (stored as 12-18)
        
        msg!("Generated random tower stats: Attack={}, Defense={}, Range={}, Speed={}", 
             attack_rand, defense_rand, range_rand, speed_rand);
        
        let tower = &mut ctx.accounts.tower;
        tower.owner = ctx.accounts.user.key();
        tower.mint = ctx.accounts.tower_mint.key();
        tower.tower_type = tower_type;
        tower.level = 1;
        tower.xp = 0;
        tower.attack = attack_rand;
        tower.defense = defense_rand;
        tower.range = range_rand;
        tower.speed = speed_rand;
        
        // Initialize upgrade levels to 0
        tower.damage_level = 0;
        tower.attack_speed_level = 0;
        tower.range_level = 0;
        tower.health_level = 0;
        tower.health_regen_level = 0;
        tower.bump = *ctx.bumps.get("tower").unwrap();
        
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_towers_owned = user_stats.total_towers_owned.checked_add(1).unwrap();
        
        Ok(())
    }

    pub fn reward_gameplay(
        ctx: Context<RewardGameplay>, 
        survival_time: i64, 
        tower_mint: Pubkey
    ) -> Result<()> {
        // Verify the game server authority
        let (game_server_pda, _) = Pubkey::find_program_address(
            &[GAME_SERVER_SEED],
            ctx.program_id
        );
        
        // Verify caller is the game server PDA
        require!(ctx.accounts.authority.key() == game_server_pda, ErrorCode::Unauthorized);
        
        // Calculate token rewards (1 token every 15 seconds)
        let token_reward = (survival_time / TOKEN_REWARD_INTERVAL).max(0) as u64;
        
        if token_reward > 0 {
            // Find the PDA for mint authority
            let seeds = &[
                MINT_AUTHORITY_SEED,
                ctx.accounts.mint.key().as_ref(),
                &[ctx.bumps.get("mint_authority").unwrap()],
            ];
            let signer = &[&seeds[..]];
            
            // Mint tokens as reward
            let cpi_accounts = mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    anchor_spl::token::MintTo {
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.token_account.to_account_info(),
                        authority: ctx.accounts.mint_authority.to_account_info(),
                    },
                    signer,
                ),
                token_reward,
            )?;
            
            // Update user stats
            let user_stats = &mut ctx.accounts.user_stats;
            user_stats.total_shards_earned = user_stats.total_shards_earned.checked_add(token_reward).unwrap();
            user_stats.total_games_played = user_stats.total_games_played.checked_add(1).unwrap();
        }
        
        // Calculate XP based on survival time (1 XP per minute)
        let xp_reward = ((survival_time / SECONDS_PER_MINUTE) as u64).checked_mul(XP_PER_MINUTE).unwrap_or(0);
        
        // Add XP to tower if a tower was used and XP was earned
        if tower_mint != Pubkey::default() && xp_reward > 0 && ctx.accounts.tower.is_some() {
            let tower = ctx.accounts.tower.as_mut().unwrap();
            
            // Manually validate the tower
            require!(tower.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);
            require!(tower.mint == tower_mint, ErrorCode::InvalidTower);
            
            let current_xp = tower.xp;
            let current_level = tower.level;
            
            // Add the XP
            tower.xp = tower.xp.checked_add(xp_reward).unwrap();
            
            // Calculate new level
            let new_level = (tower.xp / XP_PER_LEVEL).checked_add(1).unwrap() as u8;
            
            // Level up if needed
            if new_level > current_level {
                tower.level = new_level;
                
                // Update stats based on level
                tower.attack = 10u16.checked_mul(new_level as u16).unwrap();
                tower.defense = 5u16.checked_mul(new_level as u16).unwrap();
                tower.range = 2u16.checked_add((new_level as u16) / 2).unwrap();
                tower.speed = 1u16.checked_add((new_level as u16) / 3).unwrap();
            }
            
            msg!("Added {} XP to tower. New XP: {}, Level: {}", xp_reward, tower.xp, tower.level);
        }
        
        Ok(())
    }

    // Add upgrade tower damage function
    pub fn upgrade_tower_damage(ctx: Context<UpgradeTowerStat>) -> Result<()> {
        let tower = &mut ctx.accounts.tower;
        
        // Calculate the cost for this upgrade
        let cost = calculate_upgrade_cost(
            DAMAGE_UPGRADE_BASE_COST,
            DAMAGE_UPGRADE_COST_INCREMENT,
            tower.damage_level
        );
        
        // Check if user has enough funds
        if ctx.accounts.token_account.amount < cost {
            return err!(ErrorCode::InsufficientFunds);
        }
        
        // Burn tokens for the upgrade
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
        
        // Upgrade the stat
        tower.attack = tower.attack.checked_add(DAMAGE_UPGRADE_VALUE).unwrap();
        tower.damage_level = tower.damage_level.checked_add(1).unwrap();
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(cost).unwrap();
        
        Ok(())
    }
    
    // Add upgrade tower attack speed function
    pub fn upgrade_tower_attack_speed(ctx: Context<UpgradeTowerStat>) -> Result<()> {
        let tower = &mut ctx.accounts.tower;
        
        // Calculate the cost for this upgrade
        let cost = calculate_upgrade_cost(
            ATTACK_SPEED_UPGRADE_BASE_COST,
            ATTACK_SPEED_UPGRADE_COST_INCREMENT,
            tower.attack_speed_level
        );
        
        // Check if user has enough funds
        if ctx.accounts.token_account.amount < cost {
            return err!(ErrorCode::InsufficientFunds);
        }
        
        // Burn tokens for the upgrade
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
        
        // Upgrade the stat (speed is represented as integer but divided by 10 in frontend)
        tower.speed = tower.speed.checked_add(ATTACK_SPEED_UPGRADE_VALUE).unwrap();
        tower.attack_speed_level = tower.attack_speed_level.checked_add(1).unwrap();
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(cost).unwrap();
        
        Ok(())
    }
    
    // Add upgrade tower range function
    pub fn upgrade_tower_range(ctx: Context<UpgradeTowerStat>) -> Result<()> {
        let tower = &mut ctx.accounts.tower;
        
        // Calculate the cost for this upgrade
        let cost = calculate_upgrade_cost(
            RANGE_UPGRADE_BASE_COST,
            RANGE_UPGRADE_COST_INCREMENT,
            tower.range_level
        );
        
        // Check if user has enough funds
        if ctx.accounts.token_account.amount < cost {
            return err!(ErrorCode::InsufficientFunds);
        }
        
        // Burn tokens for the upgrade
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
        
        // Upgrade the stat (range is represented as integer but divided by 10 in frontend)
        tower.range = tower.range.checked_add(RANGE_UPGRADE_VALUE).unwrap();
        tower.range_level = tower.range_level.checked_add(1).unwrap();
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(cost).unwrap();
        
        Ok(())
    }
    
    // Add upgrade tower health function
    pub fn upgrade_tower_health(ctx: Context<UpgradeTowerStat>) -> Result<()> {
        let tower = &mut ctx.accounts.tower;
        
        // Calculate the cost for this upgrade
        let cost = calculate_upgrade_cost(
            HEALTH_UPGRADE_BASE_COST,
            HEALTH_UPGRADE_COST_INCREMENT,
            tower.health_level
        );
        
        // Check if user has enough funds
        if ctx.accounts.token_account.amount < cost {
            return err!(ErrorCode::InsufficientFunds);
        }
        
        // Burn tokens for the upgrade
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
        
        // Upgrade the stat
        tower.defense = tower.defense.checked_add(HEALTH_UPGRADE_VALUE).unwrap();
        tower.health_level = tower.health_level.checked_add(1).unwrap();
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(cost).unwrap();
        
        Ok(())
    }
    
    // Add upgrade tower health regen function
    pub fn upgrade_tower_health_regen(ctx: Context<UpgradeTowerStat>) -> Result<()> {
        let tower = &mut ctx.accounts.tower;
        
        // Calculate the cost for this upgrade
        let cost = calculate_upgrade_cost(
            HEALTH_REGEN_UPGRADE_BASE_COST,
            HEALTH_REGEN_UPGRADE_COST_INCREMENT,
            tower.health_regen_level
        );
        
        // Check if user has enough funds
        if ctx.accounts.token_account.amount < cost {
            return err!(ErrorCode::InsufficientFunds);
        }
        
        // Burn tokens for the upgrade
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
        
        // Since health regen isn't directly stored in tower state,
        // we just increment the level counter - the client will
        // calculate the actual regen value based on the level
        tower.health_regen_level = tower.health_regen_level.checked_add(1).unwrap();
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(cost).unwrap();
        
        Ok(())
    }

    pub fn create_game_room(
        ctx: Context<CreateGameRoom>,
        stake_amount: u64
    ) -> Result<()> {
        require!(stake_amount > 0, ErrorCode::InsufficientFunds);
        
        let game_pool = &mut ctx.accounts.game_pool;
        game_pool.game_id = ctx.accounts.game_pool.key();
        game_pool.owner = ctx.accounts.user.key();
        game_pool.stake_amount = stake_amount;
        game_pool.players = vec![ctx.accounts.user.key()];
        game_pool.is_started = false;
        game_pool.is_completed = false;
        game_pool.winner = None;
        game_pool.platform_fee = stake_amount / 20; // 5% platform fee (1/20)
        game_pool.total_pot = 0;
        game_pool.bump = *ctx.bumps.get("game_pool").unwrap();
        
        // Transfer the stake from the owner
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.treasury.key(),
            game_pool.platform_fee,
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Transfer the remaining stake to the game pool 
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.game_pool.to_account_info().key,
            stake_amount - game_pool.platform_fee,
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.game_pool.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        game_pool.total_pot = stake_amount - game_pool.platform_fee;
        
        Ok(())
    }

    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        let game_pool = &mut ctx.accounts.game_pool;
        
        // Check if game already started
        require!(!game_pool.is_started, ErrorCode::GameAlreadyStarted);
        
        // Check if player is already in the game
        require!(
            !game_pool.players.contains(&ctx.accounts.user.key()),
            ErrorCode::PlayerAlreadyJoined
        );
        
        // Transfer the stake from the player
        let platform_fee = game_pool.platform_fee;
        let stake_amount = game_pool.stake_amount;
        
        // First transfer platform fee
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.treasury.key(),
            platform_fee,
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Then transfer remaining stake to the game pool
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.game_pool.to_account_info().key,
            stake_amount - platform_fee,
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.game_pool.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Add player to the game
        game_pool.players.push(ctx.accounts.user.key());
        game_pool.total_pot += stake_amount - platform_fee;
        
        Ok(())
    }

    pub fn start_game(ctx: Context<ManageGame>) -> Result<()> {
        let game_pool = &mut ctx.accounts.game_pool;
        
        // Only the owner can start the game
        require!(game_pool.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);
        
        // Check if there are at least 2 players
        require!(game_pool.players.len() >= 2, ErrorCode::InsufficientPlayers);
        
        // Set game as started
        game_pool.is_started = true;
        
        Ok(())
    }

    pub fn end_game(ctx: Context<EndGame>, winner_index: u8) -> Result<()> {
        let game_pool = &mut ctx.accounts.game_pool;
        
        // Only the owner can end the game
        require!(game_pool.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);
        
        // Check if game is already completed
        require!(!game_pool.is_completed, ErrorCode::GameAlreadyCompleted);
        
        // Check if winner index is valid
        require!(
            (winner_index as usize) < game_pool.players.len(),
            ErrorCode::InvalidWinner
        );
        
        // Set the winner
        let winner = game_pool.players[winner_index as usize];
        game_pool.winner = Some(winner);
        game_pool.is_completed = true;
        
        // Transfer the pot to the winner
        let ix = system_instruction::transfer(
            &ctx.accounts.game_pool.to_account_info().key,
            &ctx.accounts.winner.key(),
            game_pool.total_pot,
        );
        
        let game_pool_seeds = &[
            GAME_POOL_SEED,
            ctx.accounts.user.key().as_ref(),
            &[game_pool.bump],
        ];
        let signer = &[&game_pool_seeds[..]];
        
        invoke_signed(
            &ix,
            &[
                ctx.accounts.game_pool.to_account_info(),
                ctx.accounts.winner.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
        
        // Update winner's stats
        let user_stats = &mut ctx.accounts.winner_stats;
        user_stats.total_wins = user_stats.total_wins.checked_add(1).unwrap();
        user_stats.total_games_played = user_stats.total_games_played.checked_add(1).unwrap();
        
        Ok(())
    }

    pub fn cancel_game(ctx: Context<ManageGame>) -> Result<()> {
        let game_pool = &mut ctx.accounts.game_pool;
        
        // Only the owner can cancel the game
        require!(game_pool.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);
        
        // Check if game hasn't started
        require!(!game_pool.is_started, ErrorCode::GameAlreadyStarted);
        
        // Check if game is not completed
        require!(!game_pool.is_completed, ErrorCode::GameAlreadyCompleted);
        
        // Refund all players
        for player in &game_pool.players {
            // Skip the owner as they'll be handled by account closing
            if *player == ctx.accounts.user.key() {
                continue;
            }
            
            // Calculate refund amount (stake minus platform fee)
            let refund_amount = game_pool.stake_amount - game_pool.platform_fee;
            
            // Transfer funds back to the player
            let ix = system_instruction::transfer(
                &ctx.accounts.game_pool.to_account_info().key,
                player,
                refund_amount,
            );
            
            let game_pool_seeds = &[
                GAME_POOL_SEED,
                ctx.accounts.user.key().as_ref(),
                &[game_pool.bump],
            ];
            let signer = &[&game_pool_seeds[..]];
            
            invoke_signed(
                &ix,
                &[
                    ctx.accounts.game_pool.to_account_info(),
                    // Note: we can't include the player's account here since it's not passed as an account
                    // This works because the system program just needs to know the destination address
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer,
            )?;
        }
        
        // Game will be closed and lamports returned to owner by anchor
        
        Ok(())
    }

    pub fn close_game_pool(ctx: Context<CloseGamePool>) -> Result<()> {
        let game_pool = &mut ctx.accounts.game_pool;
        
        // Only the owner can close the game pool
        require!(game_pool.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);
        
        // Check if game is not completed
        require!(!game_pool.is_completed, ErrorCode::GameAlreadyCompleted);
        
        // Refund all players
        for player in &game_pool.players {
            // Skip the owner as they'll be handled by account closing
            if *player == ctx.accounts.user.key() {
                continue;
            }
            
            // Calculate refund amount (stake minus platform fee)
            let refund_amount = game_pool.stake_amount - game_pool.platform_fee;
            
            // Transfer funds back to the player
            let ix = system_instruction::transfer(
                &ctx.accounts.game_pool.to_account_info().key,
                player,
                refund_amount,
            );
            
            let game_pool_seeds = &[
                GAME_POOL_SEED,
                ctx.accounts.user.key().as_ref(),
                &[game_pool.bump],
            ];
            let signer = &[&game_pool_seeds[..]];
            
            invoke_signed(
                &ix,
                &[
                    ctx.accounts.game_pool.to_account_info(),
                    // Note: we can't include the player's account here since it's not passed as an account
                    // This works because the system program just needs to know the destination address
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer,
            )?;
        }
        
        // Game pool will be closed and lamports returned to owner by anchor
        
        Ok(())
    }

    pub fn initialize_game_server(ctx: Context<InitializeGameServer>) -> Result<()> {
        // Initialize the game server authority - this is called once by the program admin
        let game_server = &mut ctx.accounts.game_server;
        game_server.authority = ctx.accounts.admin.key();
        game_server.bump = *ctx.bumps.get("game_server").unwrap();
        
        Ok(())
    }

    pub fn mint_starter_tower(ctx: Context<MintStarterTower>, uri: String, name: String) -> Result<()> {
        // Check if user has already claimed a starter tower
        require!(!ctx.accounts.user_stats.has_claimed_starter_tower, ErrorCode::StarterTowerAlreadyClaimed);
        
        // All towers are the same tier now, so tower_type is always 0
        let tower_type = 0;
        
        // Find the PDA for tower mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.tower_mint.key().as_ref(),
            &[ctx.bumps.get("tower_mint_authority").unwrap()],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.tower_mint.to_account_info(),
                    to: ctx.accounts.tower_token_account.to_account_info(),
                    authority: ctx.accounts.tower_mint_authority.to_account_info(),
                },
                signer,
            ),
            1,
        )?;
        
        let creator = vec![
            Creator {
                address: ctx.accounts.user.key(),
                verified: false,
                share: 100,
            },
        ];
        
        let symbol = "TOWER";
        
        let data = DataV2 {
            name: name,
            symbol: symbol.to_string(),
            uri: uri,
            seller_fee_basis_points: 500, // 5% royalty fee
            creators: Some(creator),
            collection: None,
            uses: None,
        };
        
        let accounts = CreateMetadataAccountV3 {
            metadata: ctx.accounts.metadata.key(),
            mint: ctx.accounts.tower_mint.key(),
            mint_authority: ctx.accounts.tower_mint_authority.key(),
            payer: ctx.accounts.fee_payer.key(),
            update_authority: (ctx.accounts.user.key(), true),
            system_program: ctx.accounts.system_program.key(),
            rent: Some(ctx.accounts.rent.key()),
        };
        
        let ix = CreateMetadataAccountV3::instruction(
            &accounts,
            data,
            true,
            true,
            None,
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.tower_mint.to_account_info(),
                ctx.accounts.tower_mint_authority.to_account_info(),
                ctx.accounts.fee_payer.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
        
        let master_edition_infos = [
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.tower_mint.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.tower_mint_authority.to_account_info(),
            ctx.accounts.fee_payer.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        
        invoke(
            &CreateMasterEditionV3::instruction(
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.key(),
                    mint: ctx.accounts.tower_mint.key(),
                    update_authority: ctx.accounts.user.key(),
                    mint_authority: ctx.accounts.tower_mint_authority.key(),
                    payer: ctx.accounts.fee_payer.key(),
                    metadata: ctx.accounts.metadata.key(),
                    token_program: ctx.accounts.token_program.key(),
                    system_program: ctx.accounts.system_program.key(),
                    rent: Some(ctx.accounts.rent.key()),
                },
                Some(0),
            ),
            &master_edition_infos,
        )?;
        
        let tower = &mut ctx.accounts.tower;
        tower.owner = ctx.accounts.user.key();
        tower.mint = ctx.accounts.tower_mint.key();
        tower.tower_type = tower_type;
        tower.level = 1;
        tower.xp = 0;
        
        // Starter tower base stats
        tower.attack = 15; // Slightly better than normal base stats
        tower.defense = 8;
        tower.range = 25; // 2.5 when divided by 10
        tower.speed = 12; // 1.2 when divided by 10
        
        // Initialize upgrade levels to 0
        tower.damage_level = 0;
        tower.attack_speed_level = 0;
        tower.range_level = 0;
        tower.health_level = 0;
        tower.health_regen_level = 0;
        tower.bump = *ctx.bumps.get("tower").unwrap();
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_towers_owned = user_stats.total_towers_owned.checked_add(1).unwrap();
        user_stats.has_claimed_starter_tower = true;
        
        Ok(())
    }

    pub fn initialize_fee_payer(ctx: Context<InitializeFeePayer>) -> Result<()> {
        let fee_payer = &mut ctx.accounts.fee_payer;
        fee_payer.authority = ctx.accounts.payer.key();
        fee_payer.bump = *ctx.bumps.get("fee_payer").unwrap();
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[account]
pub struct UserStats {
    pub owner: Pubkey,
    pub total_games_played: u64,
    pub total_wins: u64,
    pub total_shards_earned: u64,
    pub total_shards_spent: u64,
    pub total_towers_owned: u32,
    pub has_claimed_starter_tower: bool,
    pub bump: u8,
}

#[account]
pub struct Tower {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub tower_type: u8, // 0 = Basic, 1 = Rare, 2 = Epic, 3 = Legendary
    pub level: u8,
    pub xp: u64,
    pub attack: u16,
    pub defense: u16,
    pub range: u16,
    pub speed: u16,
    pub damage_level: u16,
    pub attack_speed_level: u16,
    pub range_level: u16,
    pub health_level: u16,
    pub health_regen_level: u16,
    pub bump: u8,
}

#[account]
pub struct GamePool {
    pub game_id: Pubkey,
    pub owner: Pubkey,
    pub stake_amount: u64,
    pub players: Vec<Pubkey>,
    pub is_started: bool,
    pub is_completed: bool,
    pub winner: Option<Pubkey>,
    pub platform_fee: u64,
    pub total_pot: u64,
    pub bump: u8,
}

#[account]
pub struct VrfClientState {
    pub vrf: Pubkey,
    pub result_buffer: [u8; 32],
    pub result_used: bool,
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
pub struct GameServer {
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeUserStats<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 4 + 1 + 1,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintShards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the token mint authority
    pub authority: UncheckedAccount<'info>,
    
    /// CHECK: PDA that acts as mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyShards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the treasury account
    #[account(
        mut,
        address = TREASURY_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub treasury: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub mint: Account<'info, Mint>,
    
    /// CHECK: PDA that acts as mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnShards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTower<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = tower_mint_authority.key(),
        mint::freeze_authority = tower_mint_authority.key()
    )]
    pub tower_mint: Account<'info, Mint>,
    
    /// CHECK: PDA that acts as tower mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED, tower_mint.key().as_ref()],
        bump
    )]
    pub tower_mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = user,
        associated_token::mint = tower_mint,
        associated_token::authority = user
    )]
    pub tower_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 1 + 8 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 1,
        seeds = [TOWER_SEED, tower_mint.key().as_ref()],
        bump
    )]
    pub tower: Account<'info, Tower>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    
    /// CHECK: This is the Metaplex program
    #[account(address = MetadataID)]
    pub token_metadata_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct UpdateTower<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [TOWER_SEED, tower.mint.as_ref()],
        bump = tower.bump
    )]
    pub tower: Account<'info, Tower>,
}

#[derive(Accounts)]
pub struct EvolveTower<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    // Old tower accounts
    #[account(
        mut,
        seeds = [TOWER_SEED, old_tower_mint.key().as_ref()],
        bump = old_tower.bump,
        constraint = old_tower.owner == user.key(),
    )]
    pub old_tower: Account<'info, Tower>,
    
    #[account(mut)]
    pub old_tower_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = old_tower_mint,
        associated_token::authority = user
    )]
    pub old_tower_token_account: Account<'info, TokenAccount>,
    
    // New tower accounts
    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = new_tower_mint_authority.key(),
        mint::freeze_authority = new_tower_mint_authority.key()
    )]
    pub new_tower_mint: Account<'info, Mint>,
    
    /// CHECK: PDA that acts as new tower mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED, new_tower_mint.key().as_ref()],
        bump
    )]
    pub new_tower_mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = user,
        associated_token::mint = new_tower_mint,
        associated_token::authority = user
    )]
    pub new_tower_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 1 + 8 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 1,
        seeds = [TOWER_SEED, new_tower_mint.key().as_ref()],
        bump
    )]
    pub new_tower: Account<'info, Tower>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    
    /// CHECK: This is the Metaplex program
    #[account(address = MetadataID)]
    pub token_metadata_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct InitializeVrfClient<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the VRF account
    pub vrf: AccountInfo<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 32 + 1,
        seeds = [VRF_STATE_SEED, user.key().as_ref()],
        bump
    )]
    pub vrf_state: Account<'info, VrfClientState>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    #[account(
        mut,
        seeds = [VRF_STATE_SEED, user.key().as_ref()],
        bump = vrf_state.bump
    )]
    pub vrf_state: Account<'info, VrfClientState>,
    
    /// CHECK: Switchboard VRF Account
    #[account(constraint = vrf_state.vrf == vrf.key())]
    pub vrf: AccountInfo<'info>,
    
    /// CHECK: Switchboard Oracle Queue Account
    pub oracle_queue: AccountInfo<'info>,
    
    /// CHECK: Oracle Queue Authority
    pub queue_authority: AccountInfo<'info>,
    
    /// CHECK: Data Buffer Account
    pub data_buffer: AccountInfo<'info>,
    
    /// CHECK: Permission Account
    pub permission: AccountInfo<'info>,
    
    /// CHECK: Escrow Account
    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,      // was AccountInfo

    /// The user’s wrapped‑SOL / SPL‑token wallet that pays fees.
    #[account(mut)]
    pub payer_wallet: Account<'info, TokenAccount>,// was AccountInfo

    /// The *authority* of `payer_wallet`. Must sign.
    pub payer_authority: Signer<'info>,            // new

    /// CHECK: Recent block‑hashes sysvar
    pub recent_blockhashes: AccountInfo<'info>,
    
    /// CHECK: Program State Account
    pub program_state: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    
    /// CHECK: Switchboard Program
    pub switchboard_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct OpenLootbox<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [VRF_STATE_SEED, user.key().as_ref()],
        bump = vrf_state.bump
    )]
    pub vrf_state: Account<'info, VrfClientState>,
    
    /// CHECK: Switchboard VRF Account
    #[account(constraint = vrf_state.vrf == vrf.key())]
    pub vrf: AccountInfo<'info>,
    
    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = tower_mint_authority.key(),
        mint::freeze_authority = tower_mint_authority.key()
    )]
    pub tower_mint: Account<'info, Mint>,
    
    /// CHECK: PDA that acts as tower mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED, tower_mint.key().as_ref()],
        bump
    )]
    pub tower_mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = user,
        associated_token::mint = tower_mint,
        associated_token::authority = user
    )]
    pub tower_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 1 + 8 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 1,
        seeds = [TOWER_SEED, tower_mint.key().as_ref()],
        bump
    )]
    pub tower: Account<'info, Tower>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    
    /// CHECK: This is the Metaplex program
    #[account(address = MetadataID)]
    pub token_metadata_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RewardGameplay<'info> {
    /// CHECK: User receiving rewards
    pub user: UncheckedAccount<'info>,
    
    /// CHECK: This is the game server authority
    #[account(
        seeds = [GAME_SERVER_SEED],
        bump
    )]
    pub authority: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub mint: Account<'info, Mint>,
    
    /// CHECK: PDA that acts as mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    // Optional tower account for XP rewards
    #[account(mut)]
    pub tower: Option<Account<'info, Tower>>,
    
    /// CHECK: Tower mint public key, provided in the instruction arguments
    pub tower_mint: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Add UpgradeTowerStat account structure for the upgrade functions
#[derive(Accounts)]
pub struct UpgradeTowerStat<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = tower.owner == user.key(),
    )]
    pub tower: Account<'info, Tower>,
    
    #[account(
        mut,
        address = SHARD_TOKEN_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateGameRoom<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the treasury account
    #[account(
        mut,
        address = TREASURY_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub treasury: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + // discriminator
               32 + // game_id
               32 + // owner
               8 +  // stake_amount
               (4 + 32 * 10) + // players (assuming max 10 players)
               1 +  // is_started
               1 +  // is_completed
               (1 + 32) + // winner (Option<Pubkey>)
               8 +  // platform_fee
               8 +  // total_pot
               1,   // bump
        seeds = [GAME_POOL_SEED, user.key().as_ref()],
        bump
    )]
    pub game_pool: Account<'info, GamePool>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the treasury account
    #[account(
        mut,
        address = TREASURY_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub treasury: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [GAME_POOL_SEED, game_pool.owner.as_ref()],
        bump = game_pool.bump
    )]
    pub game_pool: Account<'info, GamePool>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageGame<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GAME_POOL_SEED, user.key().as_ref()],
        bump = game_pool.bump,
        constraint = game_pool.owner == user.key()
    )]
    pub game_pool: Account<'info, GamePool>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndGame<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GAME_POOL_SEED, user.key().as_ref()],
        bump = game_pool.bump,
        constraint = game_pool.owner == user.key(),
        // Only close the account after the function completes and payout is done
        close = user
    )]
    pub game_pool: Account<'info, GamePool>,
    
    /// CHECK: This is the winner account
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, winner.key().as_ref()],
        bump = winner_stats.bump
    )]
    pub winner_stats: Account<'info, UserStats>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseGamePool<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GAME_POOL_SEED, user.key().as_ref()],
        bump = game_pool.bump,
        constraint = game_pool.owner == user.key() @ ErrorCode::Unauthorized,
        // You still check `!game_pool.is_completed` in your handler,
        // so we just leave `close = user` here.
        close = user
    )]
    pub game_pool: Account<'info, GamePool>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeGameServer<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 1,
        seeds = [GAME_SERVER_SEED],
        bump
    )]
    pub game_server: Account<'info, GameServer>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintStarterTower<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: Fee payer account to sponsor gas costs
    #[account(
        mut,
        address = FEE_PAYER_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub fee_payer: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [USER_STATS_SEED, user.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    #[account(
        init,
        payer = fee_payer,
        mint::decimals = 0,
        mint::authority = tower_mint_authority.key(),
        mint::freeze_authority = tower_mint_authority.key()
    )]
    pub tower_mint: Account<'info, Mint>,
    
    /// CHECK: PDA that acts as tower mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED, tower_mint.key().as_ref()],
        bump
    )]
    pub tower_mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = fee_payer,
        associated_token::mint = tower_mint,
        associated_token::authority = user
    )]
    pub tower_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = fee_payer,
        space = 8 + 32 + 32 + 1 + 1 + 8 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 1,
        seeds = [TOWER_SEED, tower_mint.key().as_ref()],
        bump
    )]
    pub tower: Account<'info, Tower>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    
    /// CHECK: This is checked in the CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    
    /// CHECK: This is the Metaplex program
    #[account(address = MetadataID)]
    pub token_metadata_program: UncheckedAccount<'info>,
}

#[account]
pub struct FeePayer {
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeFeePayer<'info> {
    #[account(
        mut,
        address = FEE_PAYER_ADDRESS.parse::<Pubkey>().unwrap()
    )]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 1,
        seeds = [FEE_PAYER_SEED],
        bump
    )]
    pub fee_payer: Account<'info, FeePayer>,
    
    pub system_program: Program<'info, System>,
}
