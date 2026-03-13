/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sss_transfer_hook.json`.
 */
export type SssTransferHook = {
  "address": "HooKDQzbbLdNExNAH4FowynGaEwtnYP6wrpz1jP19zoj",
  "metadata": {
    "name": "sssTransferHook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Stablecoin Standard - Transfer Hook Program"
  },
  "instructions": [
    {
      "name": "addToBlacklist",
      "discriminator": [
        90,
        115,
        98,
        231,
        173,
        119,
        117,
        176
      ],
      "accounts": [
        {
          "name": "blacklister",
          "writable": true,
          "signer": true
        },
        {
          "name": "blacklisterRole"
        },
        {
          "name": "mint"
        },
        {
          "name": "address"
        },
        {
          "name": "blacklistEntry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "address"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeExtraAccountMetas",
      "discriminator": [
        22,
        213,
        130,
        114,
        1,
        174,
        121,
        36
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "extraAccountMetas",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "removeFromBlacklist",
      "discriminator": [
        47,
        105,
        20,
        10,
        165,
        168,
        203,
        219
      ],
      "accounts": [
        {
          "name": "blacklister",
          "writable": true,
          "signer": true
        },
        {
          "name": "blacklisterRole"
        },
        {
          "name": "mint"
        },
        {
          "name": "blacklistEntry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "blacklist_entry.address",
                "account": "blacklistEntry"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "transferHook",
      "discriminator": [
        220,
        57,
        220,
        152,
        126,
        125,
        97,
        168
      ],
      "accounts": [
        {
          "name": "source"
        },
        {
          "name": "mint"
        },
        {
          "name": "destination"
        },
        {
          "name": "authority"
        },
        {
          "name": "extraAccountMetas"
        },
        {
          "name": "senderBlacklist"
        },
        {
          "name": "receiverBlacklist"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "blacklistEntry",
      "discriminator": [
        218,
        179,
        231,
        40,
        141,
        25,
        168,
        189
      ]
    }
  ],
  "events": [
    {
      "name": "blacklistAdded",
      "discriminator": [
        214,
        13,
        214,
        145,
        233,
        250,
        4,
        236
      ]
    },
    {
      "name": "blacklistRemoved",
      "discriminator": [
        56,
        84,
        216,
        61,
        23,
        245,
        29,
        236
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "senderBlacklisted",
      "msg": "Sender is blacklisted"
    },
    {
      "code": 6001,
      "name": "receiverBlacklisted",
      "msg": "Receiver is blacklisted"
    },
    {
      "code": 6002,
      "name": "reasonTooLong",
      "msg": "Reason exceeds maximum length"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Unauthorized: not a blacklister"
    }
  ],
  "types": [
    {
      "name": "blacklistAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "addedBy",
            "type": "pubkey"
          },
          {
            "name": "addedAt",
            "type": "i64"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "blacklistEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "addedBy",
            "type": "pubkey"
          },
          {
            "name": "addedAt",
            "type": "i64"
          },
          {
            "name": "reason",
            "docs": [
              "Compliance reason (max 128 chars). Use reference codes only, no PII."
            ],
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
      "name": "blacklistRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "removedBy",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
