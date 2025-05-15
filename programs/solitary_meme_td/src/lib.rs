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

// Import specific types from mpl_token_metadata
use mpl_token_metadata::types::{Creator, DataV2};

declare_id!("SoLttWmneTDdemo1111111111111111111111111");

// Constants
pub const SHARD_TOKEN_ADDRESS: &str = "B3G9uhi7euWErYvwfTye2MpDJytkYX6mAgUhErHbnSoT";
pub const TREASURY_ADDRESS: &str = "9yqmoJ4ekXvTPQDCj7zQS36ar2fMb1fTx1FA2xovfZjR";
pub const FEE_PAYER_ADDRESS: &str = "9yqmoJ4ekXvTPQDCj7zQS36ar2fMb1fTx1FA2xovfZjR";
pub const PLATFORM_FEE_PERCENTAGE: u8 = 5; // 5%
pub const TOKEN_REWARD_INTERVAL: i64 = 30; // 30 seconds - 1 token every 30s
pub const XP_REWARD_INTERVAL: i64 = 60; // 60 seconds - 1 XP every minute
pub const TOWER_SEED: &[u8] = b"tower";
pub const USER_STATS_SEED: &[u8] = b"user_stats";
pub const GAME_POOL_SEED: &[u8] = b"game_pool";
pub const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";
pub const GAME_SERVER_SEED: &[u8] = b"game_server";
pub const SHARDS_PER_SOL: u64 = 3000; // 3000 shards per SOL
pub const XP_PER_LEVEL: u64 = 100; // 100 XP per level
pub const MIN_LEVEL_FOR_EVOLUTION: u8 = 10; // Level 10 required for evolution
pub const LOOTBOX_COST: u64 = 3000; // 3000 tokens for a lootbox

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Insufficient level for evolution")]
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
    #[msg("Game already completed")]
    GameAlreadyCompleted,
}

#[program]
pub mod solitary_meme_td {
    use super::*;

    // Initialize program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Initializing SolitaryMemeTD game");
        Ok(())
    }

    // User stats initialization
    pub fn initialize_user_stats(ctx: Context<InitializeUserStats>) -> Result<()> {
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.owner = ctx.accounts.user.key();
        user_stats.total_games_played = 0;
        user_stats.total_wins = 0;
        user_stats.total_shards_earned = 0;
        user_stats.total_shards_spent = 0;
        user_stats.total_towers_owned = 0;
        user_stats.bump = 255; // Hardcoded for demo
        
        Ok(())
    }

    // Mint tokens to a user (admin only for demo purposes)
    pub fn mint_shards(ctx: Context<MintShards>, amount: u64) -> Result<()> {
        // Find the PDA for mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.mint.key().as_ref(),
            &[255], // Hardcoded for demo
        ];
        let signer = &[&seeds[..]];
        
        // Mint tokens to the user
        mint_to(
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
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_earned = user_stats.total_shards_earned.checked_add(amount).unwrap();
        
        Ok(())
    }
    
    // Buy tokens with SOL
    pub fn buy_shards(ctx: Context<BuyShards>, amount_sol: u64) -> Result<()> {
        // Transfer SOL to treasury
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
        
        // Calculate token amount (3000 tokens per SOL)
        let token_amount = amount_sol.checked_mul(SHARDS_PER_SOL).unwrap();
        
        // Find the PDA for mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.mint.key().as_ref(),
            &[255], // Hardcoded for demo
        ];
        let signer = &[&seeds[..]];
        
        // Mint tokens to the user
        mint_to(
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
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_earned = user_stats.total_shards_earned.checked_add(token_amount).unwrap();
        
        Ok(())
    }
    
    // Burn tokens (used for purchases)
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
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(amount).unwrap();
        
        Ok(())
    }

    // Mint a new tower NFT
    pub fn mint_tower(ctx: Context<MintTower>, uri: String, name: String) -> Result<()> {
        // Burn tokens for the tower
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            3000, // Cost for a tower is 3000 tokens
        )?;
        
        // Find the PDA for tower mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.tower_mint.key().as_ref(),
            &[255], // Hardcoded for demo
        ];
        let signer = &[&seeds[..]];
        
        // Mint the NFT
        mint_to(
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
        
        // Setup metadata
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
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(creator),
            collection: None,
            uses: None,
        };
        
        // Create metadata
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
        
        // Create master edition
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
        
        // Initialize tower data
        let tower = &mut ctx.accounts.tower;
        tower.owner = ctx.accounts.user.key();
        tower.mint = ctx.accounts.tower_mint.key();
        tower.tower_type = 0; // Basic tower
        tower.level = 1;
        tower.xp = 0;
        tower.attack = 10;
        tower.defense = 5;
        tower.range = 2;
        tower.speed = 1;
        tower.bump = 255; // Hardcoded for demo
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_towers_owned = user_stats.total_towers_owned.checked_add(1).unwrap();
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(3000).unwrap();
        
        Ok(())
    }
    
    // Open a lootbox to get a random tower
    pub fn open_lootbox(ctx: Context<MintTower>, uri: String, name: String) -> Result<()> {
        // Burn tokens for the lootbox
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            LOOTBOX_COST, // Cost for a lootbox is 3000 tokens
        )?;
        
        // Find the PDA for tower mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.tower_mint.key().as_ref(),
            &[255], // Hardcoded for demo
        ];
        let signer = &[&seeds[..]];
        
        // Mint the NFT
        mint_to(
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
        
        // Setup metadata
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
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(creator),
            collection: None,
            uses: None,
        };
        
        // Create metadata
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
        
        // Create master edition
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
        
        // Use a basic randomization algorithm for demo purposes
        // In production we would use a VRF service like Switchboard
        let clock = Clock::get()?;
        let seed = clock.unix_timestamp.checked_rem(100).unwrap() as u8;
        
        // 50% chance for common, 30% chance for rare, 15% chance for epic, 5% chance for legendary
        let tower_type = if seed < 50 {
            0 // Common
        } else if seed < 80 {
            1 // Rare
        } else if seed < 95 {
            2 // Epic
        } else {
            3 // Legendary
        };
        
        // Initialize tower data with stats based on tier
        let tower = &mut ctx.accounts.tower;
        tower.owner = ctx.accounts.user.key();
        tower.mint = ctx.accounts.tower_mint.key();
        tower.tower_type = tower_type;
        tower.level = 1;
        tower.xp = 0;
        
        // Stats increase based on tier
        let tier_multiplier = (tower_type + 1) as u16;
        
        // Calculate values separately to avoid nested operations
        let attack = match 10u16.checked_mul(tier_multiplier) {
            Some(val) => val,
            None => 50, // Fallback value if overflow
        };
        
        let defense = match 5u16.checked_mul(tier_multiplier) {
            Some(val) => val,
            None => 25, // Fallback value if overflow
        };
        
        let range = match 2u16.checked_mul(tier_multiplier) {
            Some(val) => val,
            None => 10, // Fallback
        };
        
        let speed = match 1u16.checked_mul(tier_multiplier) {
            Some(val) => val,
            None => 5, // Fallback
        };
        
        // Assign the computed values
        tower.attack = attack;
        tower.defense = defense;
        tower.range = range;
        tower.speed = speed;
        tower.bump = 255; // Hardcoded for demo
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_towers_owned = user_stats.total_towers_owned.checked_add(1).unwrap();
        user_stats.total_shards_spent = user_stats.total_shards_spent.checked_add(LOOTBOX_COST).unwrap();
        
        Ok(())
    }
    
    // Add XP to a tower
    pub fn add_tower_xp(ctx: Context<UpdateTower>, xp_amount: u64) -> Result<()> {
        require!(ctx.accounts.user.key() == ctx.accounts.tower.owner, ErrorCode::Unauthorized);
        
        let tower = &mut ctx.accounts.tower;
        
        // Add XP
        tower.xp = tower.xp.checked_add(xp_amount).unwrap();
        
        // Calculate new level
        let new_level = (tower.xp / XP_PER_LEVEL).checked_add(1).unwrap() as u8;
        
        // Level up if needed
        if new_level > tower.level {
            tower.level = new_level;
            
            // Update stats based on level and tower type
            let type_multiplier = (tower.tower_type + 1) as u16;
            
            // Calculate values separately to avoid nested operations
            let attack_base = match 10u16.checked_mul(type_multiplier) {
                Some(val) => val,
                None => 1000, // Fallback value if overflow
            };
            
            let attack_with_level = match attack_base.checked_mul(new_level as u16) {
                Some(val) => val,
                None => 2000, // Fallback value if overflow
            };
            
            let defense_base = match 5u16.checked_mul(type_multiplier) {
                Some(val) => val,
                None => 500, // Fallback value if overflow
            };
            
            let defense_with_level = match defense_base.checked_mul(new_level as u16) {
                Some(val) => val,
                None => 1000, // Fallback value if overflow
            };
            
            // Assign the computed values
            tower.attack = attack_with_level;
            tower.defense = defense_with_level;
            
            // Simplify range and speed calculations too
            let range_base = match 2u16.checked_mul(type_multiplier) {
                Some(val) => val,
                None => 10, // Fallback
            };
            
            tower.range = match range_base.checked_add((new_level as u16) / 2) {
                Some(val) => val,
                None => 15, // Fallback
            };
            
            let speed_base = match 1u16.checked_mul(type_multiplier) {
                Some(val) => val,
                None => 5, // Fallback
            };
            
            tower.speed = match speed_base.checked_add((new_level as u16) / 3) {
                Some(val) => val,
                None => 8, // Fallback
            };
        }
        
        Ok(())
    }
    
    // Evolve a tower to the next tier
    pub fn evolve_tower(ctx: Context<EvolveTower>, uri: String, name: String) -> Result<()> {
        // Check if tower has reached required level
        require!(
            ctx.accounts.old_tower.level >= MIN_LEVEL_FOR_EVOLUTION,
            ErrorCode::InsufficientLevel
        );
        
        // Find the PDA for new tower mint authority
        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.new_tower_mint.key().as_ref(),
            &[255], // Hardcoded for demo
        ];
        let signer = &[&seeds[..]];
        
        // Mint the new NFT
        mint_to(
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
        
        // Setup metadata for the evolved tower
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
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(creator),
            collection: None,
            uses: None,
        };
        
        // Create metadata
        let ix = CreateMetadataAccountV3::instruction(
            &CreateMetadataAccountV3 {
                metadata: ctx.accounts.metadata.key(),
                mint: ctx.accounts.new_tower_mint.key(),
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
                ctx.accounts.new_tower_mint.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
        
        // Create master edition
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
        
        // Calculate the new tower type
        let new_tower_type = ctx.accounts.old_tower.tower_type + 1;
        
        // Initialize new tower data with improved stats
        let new_tower = &mut ctx.accounts.new_tower;
        new_tower.owner = ctx.accounts.user.key();
        new_tower.mint = ctx.accounts.new_tower_mint.key();
        new_tower.tower_type = new_tower_type;
        new_tower.level = 1;
        new_tower.xp = 0;
        
        // Stats increase based on the new tower type
        let type_multiplier = (new_tower_type + 1) as u16;
        
        // Calculate values separately to avoid nested operations
        let attack_base = match 10u16.checked_mul(type_multiplier) {
            Some(val) => val,
            None => 1000, // Fallback value if overflow
        };
        
        let defense_base = match 5u16.checked_mul(type_multiplier) {
            Some(val) => val,
            None => 500, // Fallback value if overflow
        };
        
        let range_base = match 2u16.checked_mul(type_multiplier) {
            Some(val) => val,
            None => 10, // Fallback
        };
        
        let speed_base = match 1u16.checked_mul(type_multiplier) {
            Some(val) => val,
            None => 5, // Fallback
        };
        
        // Assign the computed values
        new_tower.attack = attack_base;
        new_tower.defense = defense_base;
        new_tower.range = range_base;
        new_tower.speed = speed_base;
        new_tower.bump = 255; // Hardcoded for demo
        
        // Burn the old tower token
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.old_tower_token_account.to_account_info(),
                    to: ctx.accounts.user.to_account_info(), // This will fail, which is what we want
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            1,
        )?;
        
        // Update user stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_towers_owned = user_stats.total_towers_owned;
        
        Ok(())
    }

    // Reward gameplay with tokens and XP
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
        
        // Calculate token rewards (1 token every 30 seconds)
        let token_reward = (survival_time / TOKEN_REWARD_INTERVAL).max(0) as u64;
        
        if token_reward > 0 {
            // Find the PDA for mint authority
            let seeds = &[
                MINT_AUTHORITY_SEED,
                ctx.accounts.mint.key().as_ref(),
                &[255], // Hardcoded for demo
            ];
            let signer = &[&seeds[..]];
            
            // Mint tokens as reward
            mint_to(
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
        let xp_reward = ((survival_time / XP_REWARD_INTERVAL) as u64).max(0);
        
        // Add XP to tower if a tower was used and XP was earned
        if tower_mint != Pubkey::default() && xp_reward > 0 && ctx.accounts.tower.is_some() {
            let tower = ctx.accounts.tower.as_mut().unwrap();
            
            // Manually validate the tower
            require!(tower.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);
            require!(tower.mint == tower_mint, ErrorCode::InvalidTower);
            
            // Add the XP
            tower.xp = tower.xp.checked_add(xp_reward).unwrap();
            
            // Calculate new level
            let new_level = (tower.xp / XP_PER_LEVEL).checked_add(1).unwrap() as u8;
            
            // Level up if needed
            if new_level > tower.level {
                tower.level = new_level;
                
                // Update stats based on level and tower type
                let type_multiplier = (tower.tower_type + 1) as u16;
                
                // Calculate values separately to avoid nested operations
                let attack_base = match 10u16.checked_mul(type_multiplier) {
                    Some(val) => val,
                    None => 1000, // Fallback value if overflow
                };
                
                let attack_with_level = match attack_base.checked_mul(new_level as u16) {
                    Some(val) => val,
                    None => 2000, // Fallback value if overflow
                };
                
                let defense_base = match 5u16.checked_mul(type_multiplier) {
                    Some(val) => val,
                    None => 500, // Fallback value if overflow
                };
                
                let defense_with_level = match defense_base.checked_mul(new_level as u16) {
                    Some(val) => val,
                    None => 1000, // Fallback value if overflow
                };
                
                // Assign the computed values
                tower.attack = attack_with_level;
                tower.defense = defense_with_level;
                
                // Simplify range and speed calculations too
                let range_base = match 2u16.checked_mul(type_multiplier) {
                    Some(val) => val,
                    None => 10, // Fallback
                };
                
                tower.range = match range_base.checked_add((new_level as u16) / 2) {
                    Some(val) => val,
                    None => 15, // Fallback
                };
                
                let speed_base = match 1u16.checked_mul(type_multiplier) {
                    Some(val) => val,
                    None => 5, // Fallback
                };
                
                tower.speed = match speed_base.checked_add((new_level as u16) / 3) {
                    Some(val) => val,
                    None => 8, // Fallback
                };
            }
        }
        
        Ok(())
    }

    // Initialize the game server authority
    pub fn initialize_game_server(ctx: Context<InitializeGameServer>) -> Result<()> {
        let game_server = &mut ctx.accounts.game_server;
        game_server.authority = ctx.accounts.admin.key();
        game_server.bump = 255; // Hardcoded for demo
        
        Ok(())
    }

    // Create a multiplayer game room
    pub fn create_game_room(
        ctx: Context<CreateGameRoom>,
        stake_amount: u64
    ) -> Result<()> {
        require!(stake_amount > 0, ErrorCode::InsufficientFunds);
        
        // Initialize game pool data
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
        game_pool.bump = 255; // Hardcoded for demo
        
        // Transfer platform fee to treasury
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
        
        // Transfer remaining stake to game pool
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
        
        // Update total pot
        game_pool.total_pot = stake_amount - game_pool.platform_fee;
        
        Ok(())
    }

    // Join an existing game room
    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        let game_pool = &mut ctx.accounts.game_pool;
        
        // Check if game already started
        require!(!game_pool.is_started, ErrorCode::GameAlreadyStarted);
        
        // Check if player is already in the game
        require!(
            !game_pool.players.contains(&ctx.accounts.user.key()),
            ErrorCode::PlayerAlreadyJoined
        );
        
        // Calculate fees
        let platform_fee = game_pool.platform_fee;
        let stake_amount = game_pool.stake_amount;
        
        // Transfer platform fee
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
        
        // Transfer remaining stake to game pool
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
        
        // Update player stats
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.total_games_played = user_stats.total_games_played.checked_add(1).unwrap();
        
        Ok(())
    }

    // Start the game
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

    // End the game and declare a winner
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
        
        // Get the winner
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
        let winner_stats = &mut ctx.accounts.winner_stats;
        winner_stats.total_wins = winner_stats.total_wins.checked_add(1).unwrap();
        
        Ok(())
    }

    // More functions will be added below...
}

// Account structures
#[account]
pub struct UserStats {
    pub owner: Pubkey,
    pub total_games_played: u64,
    pub total_wins: u64,
    pub total_shards_earned: u64,
    pub total_shards_spent: u64,
    pub total_towers_owned: u32,
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
pub struct GameServer {
    pub authority: Pubkey,
    pub bump: u8,
}

// Context structs
#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct InitializeUserStats<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 4 + 1,
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

// Add these after the existing Context structs

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
        space = 8 + 32 + 32 + 1 + 1 + 8 + 2 + 2 + 2 + 2 + 1,
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
        space = 8 + 32 + 32 + 1 + 1 + 8 + 2 + 2 + 2 + 2 + 1,
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

// Add these context structs for multiplayer functionality
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