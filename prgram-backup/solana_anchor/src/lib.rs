pub mod utils;
use borsh::{BorshDeserialize, BorshSerialize};
use {
    crate::utils::*,
    anchor_lang::{
        prelude::*,
        AnchorDeserialize,
        AnchorSerialize,
        Key,
        solana_program::{
            program_pack::Pack,
            sysvar::{clock::Clock},
            msg
        }      
    },
    spl_token::state,
    metaplex_token_metadata::{
        state::{
            MAX_SYMBOL_LENGTH,
        }
    }
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod solana_anchor {
    use super::*;

    //################################# Pool Management ########################################//

    pub fn init_pool(
        ctx : Context<InitPool>,
        _bump : u8,
        _reward_legend_amount : u64,
        _period_legend : i64,
        _stake_legend_symbol : String,
        _period_token : i64,
        _apr : i64
    ) -> ProgramResult {

        msg!("Init Pool");

        let pool = &mut ctx.accounts.pool;
        let reward_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.reward_account.data.borrow())?;
        if reward_account.owner != pool.key() {
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if reward_account.mint != *ctx.accounts.reward_mint.key {
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if _period_legend == 0 {
            return Err(PoolError::InvalidPeriod.into());
        }
        if _period_token == 0 {
            return Err(PoolError::InvalidPeriod.into());
        }

        spl_token_set_authority(TokenSetAuthorityParams {
            authority : ctx.accounts.mint_authority.clone(),
            new_authority : pool.to_account_info().clone(),
            account : ctx.accounts.reward_mint.clone(),
            token_program : ctx.accounts.token_program.clone(),
        })?;

        pool.owner = *ctx.accounts.owner.key;
        pool.rand = *ctx.accounts.rand.key;
        pool.reward_mint = *ctx.accounts.reward_mint.key;
        pool.reward_account = *ctx.accounts.reward_account.key;
        pool.reward_legend_amount = _reward_legend_amount;
        pool.period_legend = _period_legend;
        pool.stake_legend_symbol = _stake_legend_symbol;
        pool.period_token = _period_token;
        pool.stake_token_apr = _apr;
        pool.bump = _bump;
        Ok(())
    }

    pub fn update_pool(
        ctx : Context<UpdatePool>,
        _reward_legend_amount : u64,
        _period_legend : i64,
        _stake_legend_symbol : String,
        _period_token : i64,
        _apr : i64
    ) -> ProgramResult {

        msg!("Update Pool");

        let pool = &mut ctx.accounts.pool;
        if pool.owner != *ctx.accounts.owner.key {
            return Err(PoolError::InvalidOwner.into());
        }
        if _period_legend == 0 {
            return Err(PoolError::InvalidPeriod.into());
        }
        if _period_token == 0 {
            return Err(PoolError::InvalidPeriod.into());
        }

        pool.reward_legend_amount = _reward_legend_amount;
        pool.period_legend = _period_legend;
        pool.stake_legend_symbol = _stake_legend_symbol;
        pool.period_token = _period_token;
        pool.stake_token_apr = _apr;

        Ok(())
    }

    //################################# Legend Staking ########################################//

    pub fn stake_legend(
        ctx : Context<StakeLegend>,
    ) -> ProgramResult {

        msg!("Stake Legend");

        let pool = &ctx.accounts.pool;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;
        let source_nft_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.source_nft_account.data.borrow())?;
        let dest_nft_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.dest_nft_account.data.borrow())?;
        let nft_mint : state::Mint = state::Mint::unpack_from_slice(&ctx.accounts.nft_mint.data.borrow())?;
        let metadata : metaplex_token_metadata::state::Metadata =  metaplex_token_metadata::state::Metadata::from_account_info(&ctx.accounts.metadata)?;
        if nft_mint.decimals != 0 && nft_mint.supply == 1 {
            msg!("This mint is not proper nft");
            return Err(PoolError::InvalidTokenMint.into());
        }
        if metadata.mint != *ctx.accounts.nft_mint.key {
            msg!("Not match mint address");
            return Err(PoolError::InvalidMetadata.into());
        }
        if source_nft_account.owner == pool.key() {
            msg!("Source nft account's owner is not allowed to be Pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if source_nft_account.mint != *ctx.accounts.nft_mint.key {
            msg!("Not match mint address");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_nft_account.owner != pool.key() {
            msg!("Destination nft account's owner must be Pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if (&metadata.data.symbol).eq(&pool.stake_legend_symbol) {
            msg!("Not match collection symbol");
            return Err(PoolError::InvalidMetadata.into());
        }

        spl_token_transfer_without_seed(
            TokenTransferParamsWithoutSeed{
                source : ctx.accounts.source_nft_account.clone(),
                destination : ctx.accounts.dest_nft_account.clone(),
                authority : ctx.accounts.owner.clone(),
                token_program : ctx.accounts.token_program.clone(),
                amount : 1,
            }
        )?;

        let stake_data = &mut ctx.accounts.stake_data;
        stake_data.owner = *ctx.accounts.owner.key;
        stake_data.pool = pool.key();
        stake_data.account = *ctx.accounts.dest_nft_account.key;
        stake_data.stake_time = clock.unix_timestamp;
        stake_data.unstake_time = 0;
        stake_data.withdrawn_number = 0;
        stake_data.unstaked = false;
        Ok(())
    }

    pub fn unstake_legend(
        ctx : Context<UnstakeLegend>
    ) -> ProgramResult {

        msg!("Unstake Legend");

        let pool = &ctx.accounts.pool;
        let stake_data = &mut ctx.accounts.stake_data;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;

        if stake_data.unstaked {
            return Err(PoolError::AlreadyUnstaked.into());
        }
        if stake_data.owner != *ctx.accounts.owner.key {
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_data.pool != pool.key() {
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_data.account != *ctx.accounts.source_nft_account.key {
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if stake_data.account == *ctx.accounts.dest_nft_account.key {
            return Err(PoolError::InvalidTokenAccount.into());
        }

        let pool_seeds = &[
            pool.rand.as_ref(),
            &[pool.bump],
        ];

        spl_token_transfer(
            TokenTransferParams{
                source : ctx.accounts.source_nft_account.clone(),
                destination : ctx.accounts.dest_nft_account.clone(),
                authority : pool.to_account_info().clone(),
                authority_signer_seeds : pool_seeds,
                token_program : ctx.accounts.token_program.clone(),
                amount : 1,
            }
        )?;
        
        stake_data.unstaked = true;
        stake_data.unstake_time = clock.unix_timestamp;
        
        Ok(())
    }

    pub fn claim_legend(
        ctx : Context<ClaimLegend>
    ) -> ProgramResult {

        msg!("Claim Legend");

        let pool = &ctx.accounts.pool;
        let stake_data = &mut ctx.accounts.stake_data;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;
        if stake_data.owner != *ctx.accounts.owner.key {
            msg!("Not match owner");
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_data.pool != pool.key() {
            msg!("Not match pool");
            return Err(PoolError::InvalidStakeData.into());
        }
        if pool.reward_mint != *ctx.accounts.reward_mint.key {
            return Err(PoolError::InvalidTokenMint.into());
        }

        let number = ((clock.unix_timestamp - stake_data.stake_time) / pool.period_legend) as u64;
        let amount = pool.reward_legend_amount * (number - stake_data.withdrawn_number) as u64;

        let pool_seeds = &[
            pool.rand.as_ref(),
            &[pool.bump],
        ];

        spl_token_mint_to(TokenMintToParams {
            mint : ctx.accounts.reward_mint.clone(),
            destination : ctx.accounts.dest_reward_account.clone(),
            amount : amount,
            authority : pool.to_account_info().clone(),
            authority_signer_seeds : pool_seeds,
            token_program : ctx.accounts.token_program.clone(),
        })?;

        stake_data.withdrawn_number = number;

        Ok(())
    }

    //################################# Token Staking ########################################//

    pub fn stake_token(
        ctx : Context<StakeToken>,
        _amount : u64,
    ) -> ProgramResult {

        msg!("Stake Token");

        let pool = &mut ctx.accounts.pool;
        let stake_data = &mut ctx.accounts.stake_data;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;

        if pool.reward_account == *ctx.accounts.source_reward_account.key {
            msg!("Source reward account must be staker's reward account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if pool.reward_account != *ctx.accounts.dest_reward_account.key {
            msg!("Dest reward account should be pool's reward account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        
        spl_token_transfer_without_seed(
            TokenTransferParamsWithoutSeed{
                source : ctx.accounts.source_reward_account.clone(),
                destination : ctx.accounts.dest_reward_account.clone(),
                authority : ctx.accounts.owner.clone(),
                token_program : ctx.accounts.token_program.clone(),
                amount : _amount,
            }
        )?;

        stake_data.owner = *ctx.accounts.owner.key;
        stake_data.pool = pool.key();
        stake_data.account = *ctx.accounts.dest_reward_account.key;
        stake_data.stake_time = clock.unix_timestamp;
        stake_data.unstake_time = 0;
        stake_data.deposit_time = 0;
        stake_data.claim_time = 0;
        stake_data.staked_amount = _amount;
        stake_data.past_reward_amount = 0;
        stake_data.unstaked = false;

        Ok(())
    }

    pub fn unstake_token(
        ctx : Context<UnstakeToken>
    ) -> ProgramResult {

        msg!("Unstake Token");

        let pool = &mut ctx.accounts.pool;
        let stake_data = &mut ctx.accounts.stake_data;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;

        let base_time;
        if stake_data.claim_time > 0 || stake_data.deposit_time > 0 {
            if stake_data.claim_time > stake_data.deposit_time {
                base_time = stake_data.claim_time;
            } else {
                base_time = stake_data.deposit_time;
            }
        } else {
            base_time = stake_data.stake_time;
        }
        let number = ((clock.unix_timestamp - base_time) / pool.period_legend) as i64;

        if pool.period_token > (number * pool.period_legend) {
            msg!("Cooldown is not unlocked");
            return Err(PoolError::CooldownLocked.into());
        }
        if stake_data.unstaked {
            return Err(PoolError::AlreadyUnstaked.into());
        }
        if pool.reward_account != *ctx.accounts.source_reward_account.key {
            msg!("Source reward account must be pool's reward account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if pool.reward_account == *ctx.accounts.dest_reward_account.key {
            msg!("Dest reward account should be staker's reward account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        
        let pool_seeds = &[
            pool.rand.as_ref(),
            &[pool.bump],
        ];

        spl_token_transfer(
            TokenTransferParams{
                source : ctx.accounts.source_reward_account.clone(),
                destination : ctx.accounts.dest_reward_account.clone(),
                authority : pool.to_account_info().clone(),
                authority_signer_seeds : pool_seeds,
                token_program : ctx.accounts.token_program.clone(),
                amount : stake_data.staked_amount,
            }
        )?;

        stake_data.unstake_time = clock.unix_timestamp;
        stake_data.unstaked = true;

        Ok(())
    }

    pub fn deposit_token(
        ctx : Context<DepositToken>,
        _amount : u64,
    ) -> ProgramResult {

        msg!("Deposit Token");

        let pool = &mut ctx.accounts.pool;
        let stake_data = &mut ctx.accounts.stake_data;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;
        
        let base_time;
        if stake_data.claim_time > 0 || stake_data.deposit_time > 0 {
            if stake_data.claim_time > stake_data.deposit_time {
                base_time = stake_data.claim_time;
            } else {
                base_time = stake_data.deposit_time;
            }
        } else {
            base_time = stake_data.stake_time;
        }
        let number = ((clock.unix_timestamp - base_time) / pool.period_legend) as i64;

        if pool.period_token > (number * pool.period_legend) {
            msg!("Cooldown is not unlocked");
            return Err(PoolError::CooldownLocked.into());
        }
        if pool.reward_account == *ctx.accounts.source_reward_account.key {
            msg!("Source reward account must be staker's reward account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if pool.reward_account != *ctx.accounts.dest_reward_account.key {
            msg!("Dest reward account should be pool's reward account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        
        spl_token_transfer_without_seed(
            TokenTransferParamsWithoutSeed{
                source : ctx.accounts.source_reward_account.clone(),
                destination : ctx.accounts.dest_reward_account.clone(),
                authority : ctx.accounts.owner.clone(),
                token_program : ctx.accounts.token_program.clone(),
                amount : _amount,
            }
        )?;

        let amount = (stake_data.staked_amount as f64 * (pool.stake_token_apr as f64 / 100 as f64)) as u64 * number as u64;

        stake_data.deposit_time = clock.unix_timestamp;
        stake_data.past_reward_amount += amount;
        stake_data.staked_amount += _amount;

        Ok(())
    }

    pub fn claim_token(
        ctx : Context<ClaimToken>
    ) -> ProgramResult {

        msg!("Claim Token");

        let pool = &mut ctx.accounts.pool;
        let stake_data = &mut ctx.accounts.stake_data;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;

        let base_time;
        if stake_data.claim_time > 0 || stake_data.deposit_time > 0 {
            if stake_data.claim_time > stake_data.deposit_time {
                base_time = stake_data.claim_time;
            } else {
                base_time = stake_data.deposit_time;
            }
        } else {
            base_time = stake_data.stake_time;
        }
        let number = ((clock.unix_timestamp - base_time) / pool.period_legend) as i64;

        if pool.period_token > (number * pool.period_legend) {
            msg!("Cooldown is not unlocked");
            return Err(PoolError::CooldownLocked.into());
        }
        if stake_data.owner != *ctx.accounts.owner.key {
            msg!("Not match owner");
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_data.pool != pool.key() {
            msg!("Not match pool");
            return Err(PoolError::InvalidStakeData.into());
        }
        if pool.reward_mint != *ctx.accounts.reward_mint.key {
            return Err(PoolError::InvalidTokenMint.into());
        }

        let mut amount = (stake_data.staked_amount as f64 * (pool.stake_token_apr as f64 / 100 as f64)) as u64 * number as u64;
        amount += stake_data.past_reward_amount;

        let pool_seeds = &[
            pool.rand.as_ref(),
            &[pool.bump],
        ];

        spl_token_mint_to(TokenMintToParams {
            mint : ctx.accounts.reward_mint.clone(),
            destination : ctx.accounts.dest_reward_account.clone(),
            amount : amount,
            authority : pool.to_account_info().clone(),
            authority_signer_seeds : pool_seeds,
            token_program : ctx.accounts.token_program.clone(),
        })?;

        stake_data.claim_time = clock.unix_timestamp;
        stake_data.past_reward_amount = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ClaimLegend<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    pool : ProgramAccount<'info, Pool>,

    #[account(mut)]
    stake_data : ProgramAccount<'info, StakeLegendData>,

    #[account(mut,owner = spl_token::id())]
    reward_mint : AccountInfo<'info>,

    #[account(mut,owner = spl_token::id())]
    dest_reward_account : AccountInfo<'info>,

    #[account(address = spl_token::id())]
    token_program : AccountInfo<'info>,

    clock : AccountInfo<'info>,     
}

#[derive(Accounts)]
pub struct UnstakeLegend<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    pool : ProgramAccount<'info, Pool>,

    #[account(mut)]
    stake_data : ProgramAccount<'info, StakeLegendData>,

    #[account(mut,owner = spl_token::id())]
    source_nft_account : AccountInfo<'info>,

    #[account(mut,owner = spl_token::id())]
    dest_nft_account : AccountInfo<'info>,

    #[account(address = spl_token::id())]
    token_program : AccountInfo<'info>,

    clock : AccountInfo<'info>,             
}

#[derive(Accounts)]
pub struct StakeLegend<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>, 

    pool : ProgramAccount<'info, Pool>,

    #[account(init, payer = owner, space = 8 + STAKE_LEGEND_DATA_SIZE)]
    stake_data : ProgramAccount<'info, StakeLegendData>,

    #[account(owner = spl_token::id())]
    nft_mint : AccountInfo<'info>,

    #[account(mut)]
    metadata : AccountInfo<'info>,

    #[account(mut,owner = spl_token::id())]
    source_nft_account : AccountInfo<'info>,

    #[account(mut,owner = spl_token::id())]
    dest_nft_account : AccountInfo<'info>,

    #[account(address = spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,

    clock : AccountInfo<'info>,    
}

#[derive(Accounts)]
pub struct StakeToken<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>, 

    #[account(mut)]
    pool : ProgramAccount<'info, Pool>,

    #[account(init, payer = owner, space = 8 + STAKE_TOKEN_DATA_SIZE)]
    stake_data : ProgramAccount<'info, StakeTokenData>,

    #[account(mut,owner = spl_token::id())]
    source_reward_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_reward_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info, System>,

    clock : AccountInfo<'info>,    
}

#[derive(Accounts)]
pub struct DepositToken<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>, 

    #[account(mut)]
    pool : ProgramAccount<'info, Pool>,

    #[account(mut)]
    stake_data : ProgramAccount<'info, StakeTokenData>,

    #[account(mut,owner=spl_token::id())]
    source_reward_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_reward_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info, System>,

    clock : AccountInfo<'info>,    
}

#[derive(Accounts)]
pub struct ClaimToken<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    #[account(mut)]
    pool : ProgramAccount<'info, Pool>,

    #[account(mut)]
    stake_data : ProgramAccount<'info, StakeTokenData>,

    #[account(mut,owner = spl_token::id())]
    reward_mint : AccountInfo<'info>,

    #[account(mut,owner = spl_token::id())]
    dest_reward_account : AccountInfo<'info>,

    #[account(address = spl_token::id())]
    token_program : AccountInfo<'info>,

    clock : AccountInfo<'info>, 
}

#[derive(Accounts)]
pub struct UnstakeToken<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    #[account(mut)]
    pool : ProgramAccount<'info, Pool>,

    #[account(mut)]
    stake_data : ProgramAccount<'info, StakeTokenData>,

    #[account(mut,owner = spl_token::id())]
    source_reward_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_reward_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info, System>,

    clock : AccountInfo<'info>,    
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitPool<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,

    #[account(init, seeds = [(*rand.key).as_ref()], bump = _bump, payer = owner, space = 8 + POOL_SIZE)]
    pool : ProgramAccount<'info, Pool>,

    rand : AccountInfo<'info>,

    #[account(mut, owner = spl_token::id())]
    reward_mint : AccountInfo<'info>,

    #[account(mut, owner = spl_token::id())]
    reward_account : AccountInfo<'info>,

    #[account(mut, signer)]
    mint_authority : AccountInfo<'info>,

    #[account(address = spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePool<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,

    #[account(mut)]
    pool : ProgramAccount<'info, Pool>,
}

pub const POOL_SIZE : usize = 32 + 32 + 32 + 32 + 8 + 8 + 4 + MAX_SYMBOL_LENGTH + 8 + 8 + 1;
pub const STAKE_LEGEND_DATA_SIZE : usize = 1 + 32 + 32 + 32 + 8 + 8 + 8;
pub const STAKE_TOKEN_DATA_SIZE : usize = 1 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8;

#[account]
pub struct Pool {
    pub owner : Pubkey,
    pub rand : Pubkey,
    pub reward_mint : Pubkey,
    pub reward_account : Pubkey,
    pub reward_legend_amount : u64,
    pub period_legend : i64,
    pub stake_legend_symbol : String,
    pub period_token : i64,
    pub stake_token_apr : i64,
    pub bump : u8,
}

#[account]
pub struct StakeLegendData {
    pub unstaked : bool,
    pub owner : Pubkey,
    pub pool : Pubkey,
    pub account : Pubkey,
    pub stake_time : i64,
    pub unstake_time : i64,
    pub withdrawn_number : u64,
}

#[account]
pub struct StakeTokenData {
    pub unstaked : bool,
    pub owner : Pubkey,
    pub pool : Pubkey,
    pub account : Pubkey,
    pub stake_time : i64,
    pub deposit_time : i64,
    pub unstake_time : i64,
    pub claim_time : i64,
    pub staked_amount : u64,
    pub past_reward_amount : u64,
}

#[error]
pub enum PoolError {
    #[msg("Token mint to failed")]
    TokenMintToFailed,

    #[msg("Token set authority failed")]
    TokenSetAuthorityFailed,

    #[msg("Token transfer failed")]
    TokenTransferFailed,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Invalid token mint")]
    InvalidTokenMint,

    #[msg("Invalid metadata")]
    InvalidMetadata,

    #[msg("Invalid stakedata account")]
    InvalidStakeData,

    #[msg("Invalid time")]
    InvalidTime,

    #[msg("Invalid Period")]
    InvalidPeriod,

    #[msg("Already unstaked")]
    AlreadyUnstaked,

    #[msg("You are not Pool owner")]
    InvalidOwner,

    #[msg("Cooldown locked")]
    CooldownLocked,
}