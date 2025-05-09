use anchor_lang::prelude::*;

declare_id!("5Abab1zx1DVmamp9Mu3EVL1YnGnycdoVmxc81mnyzphD");

#[program]
pub mod breakout {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
