export const IDL = 
{
    "version": "0.0.0",
    "name": "solana_anchor",
    "instructions": [
      {
        "name": "initPool",
        "accounts": [
          {
            "name": "owner",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "pool",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "rand",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "rewardMint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "rewardAccount",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "period",
            "type": "i64"
          },
          {
            "name": "withdrawable",
            "type": "u8"
          },
          {
            "name": "stakeCollection",
            "type": "string"
          }
        ]
      },
      {
        "name": "stake",
        "accounts": [
          {
            "name": "owner",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "pool",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "stakeData",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "nftMint",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "metadata",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "sourceNftAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "destNftAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "clock",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": []
      },
      {
        "name": "unstake",
        "accounts": [
          {
            "name": "owner",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "pool",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "stakeData",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "sourceNftAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "destNftAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "clock",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": []
      },
      {
        "name": "claim",
        "accounts": [
          {
            "name": "owner",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "pool",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "stakeData",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "sourceRewardAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "destRewardAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "clock",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": []
      }
    ],
    "accounts": [
      {
        "name": "Pool",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "owner",
              "type": "publicKey"
            },
            {
              "name": "rand",
              "type": "publicKey"
            },
            {
              "name": "rewardMint",
              "type": "publicKey"
            },
            {
              "name": "rewardAccount",
              "type": "publicKey"
            },
            {
              "name": "rewardAmount",
              "type": "u64"
            },
            {
              "name": "period",
              "type": "i64"
            },
            {
              "name": "withdrawable",
              "type": "u8"
            },
            {
              "name": "stakeCollection",
              "type": "string"
            },
            {
              "name": "bump",
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "StakeData",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "unstaked",
              "type": "bool"
            },
            {
              "name": "owner",
              "type": "publicKey"
            },
            {
              "name": "pool",
              "type": "publicKey"
            },
            {
              "name": "account",
              "type": "publicKey"
            },
            {
              "name": "stakeTime",
              "type": "i64"
            },
            {
              "name": "withdrawnNumber",
              "type": "u8"
            }
          ]
        }
      }
    ],
    "errors": [
      {
        "code": 300,
        "name": "TokenMintToFailed",
        "msg": "Token mint to failed"
      },
      {
        "code": 301,
        "name": "TokenSetAuthorityFailed",
        "msg": "Token set authority failed"
      },
      {
        "code": 302,
        "name": "TokenTransferFailed",
        "msg": "Token transfer failed"
      },
      {
        "code": 303,
        "name": "InvalidTokenAccount",
        "msg": "Invalid token account"
      },
      {
        "code": 304,
        "name": "InvalidTokenMint",
        "msg": "Invalid token mint"
      },
      {
        "code": 305,
        "name": "InvalidMetadata",
        "msg": "Invalid metadata"
      },
      {
        "code": 306,
        "name": "InvalidStakeData",
        "msg": "Invalid stakedata account"
      },
      {
        "code": 307,
        "name": "InvalidTime",
        "msg": "Invalid time"
      },
      {
        "code": 308,
        "name": "InvalidPeriod",
        "msg": "Invalid Period"
      },
      {
        "code": 309,
        "name": "AlreadyUnstaked",
        "msg": "Already unstaked"
      }
    ]
};