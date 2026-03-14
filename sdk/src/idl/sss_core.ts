/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sss_core.json`.
 */
export type SssCore = {
  "address": "CoREe6ZkRj5QFA96vYWPqtEfbL1Cnjr1b1BsEymuAt3x",
  "metadata": {
    "name": "sssCore",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Stablecoin Standard - Core Program"
  },
  "instructions": [
    {
      "name": "acceptAuthority",
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
      ],
      "accounts": [
        {
          "name": "newAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "oldAuthority",
          "docs": [
            "Rent is returned to this account."
          ],
          "writable": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "oldAdminRole",
          "writable": true
        },
        {
          "name": "newAdminRole",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "burnTokens",
      "discriminator": [
        76,
        15,
        51,
        254,
        229,
        215,
        121,
        66
      ],
      "accounts": [
        {
          "name": "burner",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "burnerRole"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "from",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "freezeAccount",
      "discriminator": [
        253,
        75,
        82,
        133,
        167,
        238,
        43,
        130
      ],
      "accounts": [
        {
          "name": "freezer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "freezerRole"
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "grantRole",
      "discriminator": [
        218,
        234,
        128,
        15,
        82,
        33,
        236,
        253
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "adminRole"
        },
        {
          "name": "grantee"
        },
        {
          "name": "roleAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "role",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "adminRole",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeArgs"
            }
          }
        }
      ]
    },
    {
      "name": "mintTokens",
      "discriminator": [
        59,
        132,
        24,
        246,
        122,
        39,
        8,
        243
      ],
      "accounts": [
        {
          "name": "minter",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "minterRole",
          "writable": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "to",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "priceUpdate",
          "docs": [
            "Pyth PriceUpdateV2 account. Required when config.has_oracle_feed is set."
          ],
          "optional": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pause",
      "discriminator": [
        211,
        22,
        221,
        251,
        74,
        121,
        193,
        47
      ],
      "accounts": [
        {
          "name": "pauser",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "pauserRole"
        }
      ],
      "args": []
    },
    {
      "name": "proposeAuthority",
      "discriminator": [
        20,
        148,
        236,
        198,
        76,
        119,
        99,
        142
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "adminRole"
        },
        {
          "name": "newAuthority",
          "docs": [
            "requires this key to sign, proving the recipient controls it."
          ]
        }
      ],
      "args": []
    },
    {
      "name": "revokeRole",
      "discriminator": [
        179,
        232,
        2,
        180,
        48,
        227,
        82,
        7
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "adminRole"
        },
        {
          "name": "roleAccount",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "seize",
      "discriminator": [
        129,
        159,
        143,
        31,
        161,
        224,
        241,
        84
      ],
      "accounts": [
        {
          "name": "seizer",
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "NO pause check -- seizure works during emergencies."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "seizerRole"
        },
        {
          "name": "mint"
        },
        {
          "name": "from",
          "writable": true
        },
        {
          "name": "to",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "thawAccount",
      "discriminator": [
        115,
        152,
        79,
        213,
        213,
        169,
        184,
        35
      ],
      "accounts": [
        {
          "name": "freezer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "freezerRole"
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "unpause",
      "discriminator": [
        169,
        144,
        4,
        38,
        10,
        141,
        188,
        255
      ],
      "accounts": [
        {
          "name": "pauser",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "pauserRole"
        }
      ],
      "args": []
    },
    {
      "name": "updateMinter",
      "discriminator": [
        164,
        129,
        164,
        88,
        75,
        29,
        91,
        38
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "adminRole"
        },
        {
          "name": "minterRole",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newQuota",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "updateOracle",
      "discriminator": [
        112,
        41,
        209,
        18,
        248,
        226,
        252,
        188
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "adminRole"
        }
      ],
      "args": [
        {
          "name": "oracleFeedId",
          "type": {
            "option": {
              "array": [
                "u8",
                32
              ]
            }
          }
        }
      ]
    },
    {
      "name": "updateSupplyCap",
      "discriminator": [
        9,
        215,
        52,
        77,
        1,
        9,
        162,
        17
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "config"
              }
            ]
          }
        },
        {
          "name": "adminRole"
        }
      ],
      "args": [
        {
          "name": "newSupplyCap",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "updateTransferFee",
      "discriminator": [
        135,
        106,
        57,
        77,
        93,
        247,
        210,
        158
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "adminRole"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "newBasisPoints",
          "type": "u16"
        },
        {
          "name": "newMaximumFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawWithheld",
      "discriminator": [
        102,
        28,
        32,
        66,
        152,
        119,
        206,
        241
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  115,
                  115,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "adminRole"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "feeDestination",
          "docs": [
            "The destination token account to receive collected fees."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "priceUpdateV2",
      "discriminator": [
        34,
        241,
        35,
        99,
        157,
        126,
        244,
        205
      ]
    },
    {
      "name": "roleAccount",
      "discriminator": [
        142,
        236,
        135,
        197,
        214,
        3,
        244,
        226
      ]
    },
    {
      "name": "stablecoinConfig",
      "discriminator": [
        127,
        25,
        244,
        213,
        1,
        192,
        101,
        6
      ]
    }
  ],
  "events": [
    {
      "name": "accountFrozen",
      "discriminator": [
        221,
        214,
        59,
        29,
        246,
        50,
        119,
        206
      ]
    },
    {
      "name": "accountThawed",
      "discriminator": [
        49,
        63,
        73,
        105,
        129,
        190,
        40,
        119
      ]
    },
    {
      "name": "authorityProposed",
      "discriminator": [
        244,
        117,
        94,
        112,
        53,
        151,
        35,
        89
      ]
    },
    {
      "name": "authorityTransferred",
      "discriminator": [
        245,
        109,
        179,
        54,
        135,
        92,
        22,
        64
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "operationsPaused",
      "discriminator": [
        173,
        3,
        52,
        125,
        217,
        125,
        167,
        81
      ]
    },
    {
      "name": "operationsUnpaused",
      "discriminator": [
        54,
        216,
        228,
        170,
        9,
        168,
        101,
        17
      ]
    },
    {
      "name": "roleGranted",
      "discriminator": [
        220,
        183,
        89,
        228,
        143,
        63,
        246,
        58
      ]
    },
    {
      "name": "roleRevoked",
      "discriminator": [
        167,
        183,
        52,
        229,
        126,
        206,
        62,
        61
      ]
    },
    {
      "name": "stablecoinInitialized",
      "discriminator": [
        238,
        217,
        135,
        14,
        147,
        33,
        221,
        169
      ]
    },
    {
      "name": "tokensBurned",
      "discriminator": [
        230,
        255,
        34,
        113,
        226,
        53,
        227,
        9
      ]
    },
    {
      "name": "tokensMinted",
      "discriminator": [
        207,
        212,
        128,
        194,
        175,
        54,
        64,
        24
      ]
    },
    {
      "name": "tokensSeized",
      "discriminator": [
        51,
        129,
        131,
        114,
        206,
        234,
        140,
        122
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "paused",
      "msg": "Operations are paused"
    },
    {
      "code": 6001,
      "name": "notPaused",
      "msg": "Operations are not paused"
    },
    {
      "code": 6002,
      "name": "supplyCapExceeded",
      "msg": "Supply cap exceeded"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Unauthorized: missing required role"
    },
    {
      "code": 6004,
      "name": "invalidPreset",
      "msg": "Invalid preset value (must be 1-4)"
    },
    {
      "code": 6005,
      "name": "lastAdmin",
      "msg": "Cannot remove the last admin"
    },
    {
      "code": 6006,
      "name": "arithmeticOverflow",
      "msg": "Overflow in arithmetic operation"
    },
    {
      "code": 6007,
      "name": "mintMismatch",
      "msg": "Mint mismatch"
    },
    {
      "code": 6008,
      "name": "invalidSupplyCap",
      "msg": "Invalid supply cap: must be >= current supply"
    },
    {
      "code": 6009,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6010,
      "name": "invalidRole",
      "msg": "Invalid role value"
    },
    {
      "code": 6011,
      "name": "quotaExceeded",
      "msg": "Minter quota exceeded"
    },
    {
      "code": 6012,
      "name": "nameTooLong",
      "msg": "Name exceeds maximum length of 32 characters"
    },
    {
      "code": 6013,
      "name": "symbolTooLong",
      "msg": "Symbol exceeds maximum length of 10 characters"
    },
    {
      "code": 6014,
      "name": "uriTooLong",
      "msg": "URI exceeds maximum length of 200 characters"
    },
    {
      "code": 6015,
      "name": "notSss4",
      "msg": "Instruction requires SSS-4 preset"
    },
    {
      "code": 6016,
      "name": "invalidFeeBasisPoints",
      "msg": "Transfer fee basis points cannot exceed 10000"
    },
    {
      "code": 6017,
      "name": "noPendingAuthority",
      "msg": "No pending authority transfer to accept"
    },
    {
      "code": 6018,
      "name": "unauthorizedAcceptor",
      "msg": "Signer does not match the pending authority"
    },
    {
      "code": 6019,
      "name": "oracleFeedNotConfigured",
      "msg": "Oracle feed not configured"
    },
    {
      "code": 6020,
      "name": "priceUpdateRequired",
      "msg": "Price update account required when oracle is configured"
    },
    {
      "code": 6021,
      "name": "oracleFeedIdMismatch",
      "msg": "Oracle feed ID mismatch"
    },
    {
      "code": 6022,
      "name": "priceTooOld",
      "msg": "Price too old or stale"
    }
  ],
  "types": [
    {
      "name": "accountFrozen",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "account",
            "type": "pubkey"
          },
          {
            "name": "freezer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "accountThawed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "account",
            "type": "pubkey"
          },
          {
            "name": "freezer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "authorityProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "proposed",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "authorityTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "field",
            "type": "string"
          },
          {
            "name": "oldValue",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "newValue",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "updater",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "initializeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "preset",
            "type": "u8"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "supplyCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "enablePermanentDelegate",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "enableTransferHook",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "defaultAccountFrozen",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "oracleFeedId",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "transferFeeBasisPoints",
            "docs": [
              "SSS-4: initial transfer fee in basis points (0-10000)."
            ],
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "maximumFee",
            "docs": [
              "SSS-4: maximum fee per transfer in token base units."
            ],
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "operationsPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "pauser",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "operationsUnpaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "pauser",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "priceFeedMessage",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "docs": [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "docs": [
              "The timestamp of this price update in seconds"
            ],
            "type": "i64"
          },
          {
            "name": "prevPublishTime",
            "docs": [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ],
            "type": "i64"
          },
          {
            "name": "emaPrice",
            "type": "i64"
          },
          {
            "name": "emaConf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "priceUpdateV2",
      "docs": [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "verificationLevel",
            "type": {
              "defined": {
                "name": "verificationLevel"
              }
            }
          },
          {
            "name": "priceMessage",
            "type": {
              "defined": {
                "name": "priceFeedMessage"
              }
            }
          },
          {
            "name": "postedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "role",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "admin"
          },
          {
            "name": "minter"
          },
          {
            "name": "freezer"
          },
          {
            "name": "pauser"
          },
          {
            "name": "burner"
          },
          {
            "name": "blacklister"
          },
          {
            "name": "seizer"
          }
        ]
      }
    },
    {
      "name": "roleAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "role",
            "type": {
              "defined": {
                "name": "role"
              }
            }
          },
          {
            "name": "grantedBy",
            "type": "pubkey"
          },
          {
            "name": "grantedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "mintQuota",
            "docs": [
              "Per-minter quota: maximum tokens this minter may mint. None = unlimited."
            ],
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "amountMinted",
            "docs": [
              "Cumulative amount minted by this minter."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "roleGranted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "role",
            "type": "u8"
          },
          {
            "name": "grantedBy",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "roleRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "role",
            "type": "u8"
          },
          {
            "name": "revokedBy",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "stablecoinConfig",
      "docs": [
        "Zero-copy config account. Uses `repr(packed)` via `zero_copy(unsafe)` to",
        "avoid padding between heterogeneous field types (u8 next to u64).",
        "Safe on Solana's BPF/SBF VM which supports unaligned memory access."
      ],
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "rust",
        "packed": true
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "preset",
            "type": "u8"
          },
          {
            "name": "paused",
            "docs": [
              "0 = not paused, 1 = paused (u8 for repr(C) compat)"
            ],
            "type": "u8"
          },
          {
            "name": "hasSupplyCap",
            "docs": [
              "0 = no cap, 1 = cap enabled"
            ],
            "type": "u8"
          },
          {
            "name": "supplyCap",
            "type": "u64"
          },
          {
            "name": "totalMinted",
            "type": "u64"
          },
          {
            "name": "totalBurned",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "symbol",
            "type": {
              "array": [
                "u8",
                10
              ]
            }
          },
          {
            "name": "uri",
            "type": {
              "array": [
                "u8",
                200
              ]
            }
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "enablePermanentDelegate",
            "type": "u8"
          },
          {
            "name": "enableTransferHook",
            "type": "u8"
          },
          {
            "name": "defaultAccountFrozen",
            "type": "u8"
          },
          {
            "name": "adminCount",
            "type": "u16"
          },
          {
            "name": "hasOracleFeed",
            "docs": [
              "0 = no oracle, 1 = oracle configured"
            ],
            "type": "u8"
          },
          {
            "name": "oracleFeedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "transferFeeBasisPoints",
            "type": "u16"
          },
          {
            "name": "maximumFee",
            "type": "u64"
          },
          {
            "name": "hasPendingAuthority",
            "docs": [
              "0 = no pending transfer, 1 = pending"
            ],
            "type": "u8"
          },
          {
            "name": "pendingAuthority",
            "type": "pubkey"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                31
              ]
            }
          }
        ]
      }
    },
    {
      "name": "stablecoinInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "preset",
            "type": "u8"
          },
          {
            "name": "supplyCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "decimals",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokensBurned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "fromOwner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "burner",
            "type": "pubkey"
          },
          {
            "name": "newSupply",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokensMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "newSupply",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokensSeized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "seizer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "verificationLevel",
      "docs": [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "partial",
            "fields": [
              {
                "name": "numSignatures",
                "type": "u8"
              }
            ]
          },
          {
            "name": "full"
          }
        ]
      }
    }
  ]
};
