//! Utility functions and types.
use std::ops::{Div, Mul};

use crate::constants::MAX_NETWORK_FEE;
use anchor_lang::context::CpiContext;
use anchor_lang::prelude::{Interface, InterfaceAccount, Pubkey, Signer};
use anchor_lang::ToAccountInfo;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};
use solana_program::entrypoint::ProgramResult;

use crate::errors::{GatekeeperErrors, NetworkErrors};
use crate::state::{GatekeeperAuthKey, GatekeeperFees, GatekeeperKeyFlags, NetworkFeesPercentage};

// pub const OC_SIZE_BOOL: usize = 1;
pub const OC_SIZE_U8: usize = 1;
pub const OC_SIZE_U16: usize = 2;
pub const OC_SIZE_U32: usize = 4;
pub const OC_SIZE_U64: usize = 8;
// pub const OC_SIZE_U128: usize = 16;
pub const OC_SIZE_PUBKEY: usize = 32;
pub const OC_SIZE_VEC_PREFIX: usize = 4;
// pub const OC_SIZE_STRING_PREFIX: usize = 4;
pub const OC_SIZE_DISCRIMINATOR: usize = 8;
// pub const OC_SIZE_TIMESTAMP: usize = 8;

// validate_fees_within_bounds returns true when
// the fees in NetworkFeesPercentage are not more than MAX_NETWORK_FEE
pub fn validate_fees_within_bounds(fees: &[NetworkFeesPercentage]) -> bool {
    fees.iter().all(|fee| {
        fee.issue <= MAX_NETWORK_FEE
            && fee.refresh <= MAX_NETWORK_FEE
            && fee.expire <= MAX_NETWORK_FEE
            && fee.verify <= MAX_NETWORK_FEE
    })
}

pub fn get_gatekeeper_fees(
    fees: &[GatekeeperFees],
    mint: Pubkey,
) -> Result<&GatekeeperFees, GatekeeperErrors> {
    fees.iter()
        .find(|&&x| x.token == mint)
        .ok_or(GatekeeperErrors::FeesNotProvided)
}

pub fn get_network_fees(
    fees: &[NetworkFeesPercentage],
    mint: Pubkey,
) -> Result<&NetworkFeesPercentage, NetworkErrors> {
    fees.iter()
        .find(|&&x| x.token == mint)
        .ok_or(NetworkErrors::FeesNotProvided)
}

/// calculate_network_and_gatekeeper_fee
/// Returns two fees in the correct unit
/// First result returns the fee for the network_fee
/// Second result returns the gatekeeper fee
pub fn calculate_network_and_gatekeeper_fee(fee: u64, percent: u16) -> (u64, u64) {
    let percent = if percent > 10000 { 10000 } else { percent };
    let percentage = (percent as f64).div(10000_f64);
    let network_fee = (fee as f64).mul(percentage);

    let gatekeeper_fee = (fee) - (network_fee as u64);
    (network_fee as u64, gatekeeper_fee)
}

pub fn create_and_invoke_transfer<'a>(
    spl_token_address: Interface<'a, TokenInterface>,
    source_account: InterfaceAccount<'a, TokenAccount>,
    destination_account: InterfaceAccount<'a, TokenAccount>,
    mint: InterfaceAccount<'a, Mint>,
    authority_account: Signer<'a>,
    amount: u64,
) -> ProgramResult {
    let accounts_checked = TransferChecked {
        from: source_account.to_account_info(),
        mint: mint.to_account_info(),
        to: destination_account.to_account_info(),
        authority: authority_account.to_account_info(),
    };

    transfer_checked(
        CpiContext::new(spl_token_address.to_account_info(), accounts_checked),
        amount,
        mint.decimals,
    )?;

    Ok(())
}

pub fn check_gatekeeper_auth_threshold(
    auth_keys: &[GatekeeperAuthKey],
    auth_threshold: u8,
) -> bool {
    let auth_key_count = auth_keys
        .iter()
        .filter(|key| {
            GatekeeperKeyFlags::from_bits_truncate(key.flags).contains(GatekeeperKeyFlags::AUTH)
        })
        .count();

    auth_key_count >= auth_threshold as usize
}

#[cfg(test)]
mod tests {
    use crate::state::{GatekeeperAuthKey, GatekeeperFees, NetworkFeesPercentage};
    use crate::util::{check_gatekeeper_auth_threshold, validate_fees_within_bounds};

    #[test]
    fn test_check_fees_percentage() {
        // Test case where there are fees but one of them is over 100%
        let fee1 = NetworkFeesPercentage {
            token: Default::default(),
            issue: 6,
            refresh: 8,
            expire: 8,
            verify: 8,
        };

        let fee2 = NetworkFeesPercentage {
            token: Default::default(),
            issue: 5,
            refresh: 5,
            expire: 3,
            verify: 10001,
        };

        assert!(validate_fees_within_bounds(&[fee1]));
        assert!(!validate_fees_within_bounds(&[fee1, fee2]));
    }

    #[test]
    fn get_fees_test_split_100() {
        let fees = crate::util::calculate_network_and_gatekeeper_fee(100, 10000);
        assert_eq!(fees.0, 100);
        assert_eq!(fees.1, 0);
    }

    #[test]
    fn get_fees_test() {
        let fees = crate::util::calculate_network_and_gatekeeper_fee(10000, 500);
        assert_eq!(fees.0, 500);
        assert_eq!(fees.1, 9500);
    }

    #[test]
    fn get_fees_test_split_5() {
        let fees = crate::util::calculate_network_and_gatekeeper_fee(100, 500);
        assert_eq!(fees.0, 5);
        assert_eq!(fees.1, 95);
    }

    #[test]
    fn get_fees_test_split_zero() {
        let fees = crate::util::calculate_network_and_gatekeeper_fee(100, 0);
        assert_eq!(fees.0, 0);
        assert_eq!(fees.1, 100);
    }

    #[test]
    fn get_gatekeeper_fees_test() {
        let mint = "wLYV8imcPhPDZ3JJvUgSWv2p6PNz4RfFtveqn4esJGX"
            .parse()
            .unwrap();
        let fee1 = GatekeeperFees {
            token: mint,
            issue: 100,
            verify: 10,
            refresh: 10,
            expire: 10,
        };
        let fee2 = GatekeeperFees {
            token: "wLYV8imcPhPDZ3JJvUgSWv2p6PNz4RfFtvdqn4esJGX"
                .parse()
                .unwrap(),
            issue: 0,
            verify: 0,
            refresh: 0,
            expire: 0,
        };
        let fees: Vec<GatekeeperFees> = vec![fee1, fee2];
        let fee = crate::util::get_gatekeeper_fees(&fees, mint).unwrap();
        assert_eq!(fee, &fee1);
    }

    #[test]
    fn get_network_fees() {
        let mint = "wLYV8imcPhPDZ3JJvUgSWv2p6PNz4RfFtveqn4esJGX"
            .parse()
            .unwrap();
        let fee1 = NetworkFeesPercentage {
            token: mint,
            issue: 100,
            verify: 10,
            refresh: 10,
            expire: 10,
        };
        let fee2 = NetworkFeesPercentage {
            token: "wLYV8imcPhPDZ3JJvUgSWv2p6PNz4RfFtvdqn4esJGX"
                .parse()
                .unwrap(),
            issue: 0,
            verify: 0,
            refresh: 0,
            expire: 0,
        };
        let fees: Vec<NetworkFeesPercentage> = vec![fee1, fee2];
        let fee = crate::util::get_network_fees(&fees, mint).unwrap();
        assert_eq!(fee, &fee1);
    }

    #[test]
    fn valid_auth_threshold() {
        let key1 = GatekeeperAuthKey {
            key: "wLYV8imcPhPDZ3JJvUgSWv2p6PNz4RfFtvdqn4esJGX"
                .parse()
                .unwrap(),
            //TODO: Why we cannot pass GatekeeperKeyFlags::Auth ??
            flags: 1,
        };

        let key2 = GatekeeperAuthKey {
            key: "3XfJXLJm3YUgoroxNQeo5yxLPd4SYC4W9usQwDi2n4Dd"
                .parse()
                .unwrap(),
            flags: 1,
        };

        let auth_keys = vec![key1, key2];
        let valid = check_gatekeeper_auth_threshold(&auth_keys, 2);

        assert!(valid);
    }

    #[test]
    fn invalid_auth_threshold() {
        let key1 = GatekeeperAuthKey {
            key: "wLYV8imcPhPDZ3JJvUgSWv2p6PNz4RfFtvdqn4esJGX"
                .parse()
                .unwrap(),
            flags: 1,
        };

        let key2 = GatekeeperAuthKey {
            key: "3XfJXLJm3YUgoroxNQeo5yxLPd4SYC4W9usQwDi2n4Dd"
                .parse()
                .unwrap(),
            flags: 1,
        };

        let auth_keys = vec![key1, key2];
        let valid = check_gatekeeper_auth_threshold(&auth_keys, 3);

        assert!(!valid);
    }

    #[test]
    fn no_auth_threshold() {
        let key = GatekeeperAuthKey {
            key: "wLYV8imcPhPDZ3JJvUgSWv2p6PNz4RfFtvdqn4esJGX"
                .parse()
                .unwrap(),
            flags: 0,
        };

        let auth_keys = vec![key];
        let valid = check_gatekeeper_auth_threshold(&auth_keys, 1);

        assert!(!valid);
    }
}
