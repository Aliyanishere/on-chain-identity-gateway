import { Assignable, Enum, SCHEMA } from "./solanaBorsh";
import { PROGRAM_ID } from "./constants";
import {
  AccountMeta,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { Active, Frozen, GatewayTokenState, Revoked } from "./GatewayTokenData";
import { NetworkFeature, UserTokenExpiry } from "./GatewayNetworkData";
import { getFeatureAccountAddress } from "./util";
import { AssignablePublicKey } from "./AssignablePublicKey";

/**
 * Creates instructions to send to the gateway program.
 *
 * Must match solana/program/src/instruction.rs
 */

class AddGatekeeper extends Assignable {}
class Issue extends Assignable {
  seed?: Uint8Array;
  expireTime?: number;
}
class SetState extends Assignable {
  state!: GatewayTokenState;
}
class UpdateExpiry extends Assignable {
  expireTime!: number;
}
class RevokeGatekeeper extends Assignable {}
class AddFeatureToNetwork extends Assignable {
  feature!: NetworkFeature;
}
class RemoveFeatureFromNetwork extends Assignable {
  feature!: NetworkFeature;
}

class ExpireToken extends Assignable {
  padding?: Uint8Array;
  gatekeeperNetwork!: AssignablePublicKey;
}
class BurnToken extends Assignable {}

export class GatewayInstruction extends Enum {
  addGatekeeper?: AddGatekeeper;
  issue?: Issue;
  setState?: SetState;
  updateExpiry?: UpdateExpiry;
  revokeGatekeeper?: RevokeGatekeeper;
  addFeatureToNetwork?: AddFeatureToNetwork;
  removeFeatureFromNetwork?: RemoveFeatureFromNetwork;
  expireToken?: ExpireToken;
  burnToken?: BurnToken;

  static addGatekeeper(): GatewayInstruction {
    return new GatewayInstruction({
      addGatekeeper: new AddGatekeeper({}),
    });
  }

  static issue(seed?: Uint8Array, expireTime?: number): GatewayInstruction {
    return new GatewayInstruction({
      issue: new Issue({ seed, expireTime }),
    });
  }

  static revoke(): GatewayInstruction {
    return new GatewayInstruction({
      setState: new SetState({
        state: new GatewayTokenState({ revoked: new Revoked({}) }),
      }),
    });
  }

  static freeze(): GatewayInstruction {
    return new GatewayInstruction({
      setState: new SetState({
        state: new GatewayTokenState({ frozen: new Frozen({}) }),
      }),
    });
  }

  static unfreeze(): GatewayInstruction {
    return new GatewayInstruction({
      setState: new SetState({
        state: new GatewayTokenState({ active: new Active({}) }),
      }),
    });
  }

  static updateExpiry(expireTime: number): GatewayInstruction {
    return new GatewayInstruction({
      updateExpiry: new UpdateExpiry({
        expireTime,
      }),
    });
  }

  static revokeGatekeeper(): GatewayInstruction {
    return new GatewayInstruction({
      revokeGatekeeper: new RevokeGatekeeper({}),
    });
  }

  static addFeatureToNetwork(feature: NetworkFeature): GatewayInstruction {
    return new GatewayInstruction({
      addFeatureToNetwork: new AddFeatureToNetwork({
        feature,
      }),
    });
  }

  static removeFeatureFromNetwork(feature: NetworkFeature): GatewayInstruction {
    return new GatewayInstruction({
      removeFeatureFromNetwork: new RemoveFeatureFromNetwork({
        feature,
      }),
    });
  }

  static expireToken(gatekeeperNetwork: PublicKey): GatewayInstruction {
    return new GatewayInstruction({
      expireToken: new ExpireToken({
        // padding: null,
        gatekeeperNetwork: AssignablePublicKey.fromPublicKey(gatekeeperNetwork),
      }),
    });
  }

  static burnToken(): GatewayInstruction {
    return new GatewayInstruction({
      burnToken: new BurnToken({}),
    });
  }
}

/**
 * Add a gatekeeper to a gatekeeper network.
 * Returns a Solana instruction that must be signed by the gatekeeper network authority.
 *
 * @param payer The payer of the transaction (used to pay rent into the gatekeeper account)
 * @param gatekeeperAccount An uninitialised gatekeeper account PDA. The address must be derived via getGatekeeperAccountKeyFromGatekeeperAuthority()
 * @param gatekeeperAuthority The gatekeeper to add to the network
 * @param network The gatekeeper network that the account is being added to.
 */
export function addGatekeeper(
  payer: PublicKey,
  gatekeeperAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  network: PublicKey,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: gatekeeperAccount, isSigner: false, isWritable: true },
    { pubkey: gatekeeperAuthority, isSigner: false, isWritable: false },
    { pubkey: network, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const data = GatewayInstruction.addGatekeeper().encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Removes a gatekeeper from a gatekeeper network.
 * Returns a Solana instruction that must be signed by the gatekeeper network authority.
 *
 * @param funds_to The account the gatekeeper account's rent goes to
 * @param gatekeeperAccount The gatekeeper account PDA. The address must be derived via getGatekeeperAccountKeyFromGatekeeperAuthority()
 * @param gatekeeperAuthority The gatekeeper to remove from the network
 * @param network The gatekeeper network that the account is being removed from.
 */
export function revokeGatekeeper(
  funds_to: PublicKey,
  gatekeeperAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  network: PublicKey,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: funds_to, isSigner: false, isWritable: true },
    { pubkey: gatekeeperAccount, isSigner: false, isWritable: true },
    { pubkey: gatekeeperAuthority, isSigner: false, isWritable: false },
    { pubkey: network, isSigner: true, isWritable: false },
  ];
  const data = GatewayInstruction.revokeGatekeeper().encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Issue a gateway token to the owner publicKey.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param gatewayTokenAccount An uninitialised gateway token account PDA. The address must be derived via getGatewayTokenAddressForOwnerAndGatekeeperNetwork
 * @param payer The payer of the transaction (used to pay rent into the gatekeeper account).
 * @param gatekeeperAccount The account in the gatekeeper network of the gatekeeper issuing the token
 * @param owner The recipient of the token
 * @param gatekeeperAuthority The gatekeeper issuing the token
 * @param gatekeeperNetwork The network that the gatekeeper belongs to
 * @param seed An 8-byte seed array, used to add multiple tokens to the same owner. Must be unique to each token, if present
 * @param expireTime The unix timestamp at which the token is no longer valid
 */
export function issue(
  gatewayTokenAccount: PublicKey,
  payer: PublicKey,
  gatekeeperAccount: PublicKey,
  owner: PublicKey,
  gatekeeperAuthority: PublicKey,
  gatekeeperNetwork: PublicKey,
  seed?: Uint8Array,
  expireTime?: number,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: gatewayTokenAccount, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: gatekeeperAccount, isSigner: false, isWritable: false },
    { pubkey: gatekeeperAuthority, isSigner: true, isWritable: false },
    { pubkey: gatekeeperNetwork, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const data = GatewayInstruction.issue(seed, expireTime).encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

const getStateChangeAccountMeta = (
  gatewayTokenAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  gatekeeperAccount: PublicKey,
): AccountMeta[] => [
  { pubkey: gatewayTokenAccount, isSigner: false, isWritable: true },
  { pubkey: gatekeeperAuthority, isSigner: true, isWritable: false },
  { pubkey: gatekeeperAccount, isSigner: false, isWritable: false },
];

/**
 * Revoke a gateway token.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param gatewayTokenAccount The gateway token to revoke
 * @param gatekeeperAuthority The gatekeeper revoking the token (must be in the same network as the issuing gatekeeper)
 * @param gatekeeperAccount The account in the gatekeeper network of the gatekeeper revoking the token
 */
export function revoke(
  gatewayTokenAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  gatekeeperAccount: PublicKey,
): TransactionInstruction {
  const keys: AccountMeta[] = getStateChangeAccountMeta(
    gatewayTokenAccount,
    gatekeeperAuthority,
    gatekeeperAccount,
  );
  const data = GatewayInstruction.revoke().encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Freeze a gateway token.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param gatewayTokenAccount The gateway token to freeze
 * @param gatekeeperAuthority The gatekeeper freezing the token (must be equal to the issuing gatekeeper)
 * @param gatekeeperAccount The account in the gatekeeper network of the gatekeeper freezing the token
 */
export function freeze(
  gatewayTokenAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  gatekeeperAccount: PublicKey,
): TransactionInstruction {
  const keys: AccountMeta[] = getStateChangeAccountMeta(
    gatewayTokenAccount,
    gatekeeperAuthority,
    gatekeeperAccount,
  );
  const data = GatewayInstruction.freeze().encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Unfreeze a gateway token.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param gatewayTokenAccount The gateway token to unfreeze
 * @param gatekeeperAuthority The gatekeeper unfreezing the token (must be equal to the issuing gatekeeper)
 * @param gatekeeperAccount The account in the gatekeeper network of the gatekeeper unfreezing the token
 */
export function unfreeze(
  gatewayTokenAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  gatekeeperAccount: PublicKey,
): TransactionInstruction {
  const keys: AccountMeta[] = getStateChangeAccountMeta(
    gatewayTokenAccount,
    gatekeeperAuthority,
    gatekeeperAccount,
  );
  const data = GatewayInstruction.unfreeze().encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Update the expiry time of a gateway token.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param gatewayTokenAccount The gateway token to be updated (must have an expiry time)
 * @param gatekeeperAuthority The gatekeeper (must be equal to the issuing gatekeeper)
 * @param gatekeeperAccount The account in the gatekeeper network of the gatekeeper
 * @param expireTime The new expiry time
 */
export function updateExpiry(
  gatewayTokenAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  gatekeeperAccount: PublicKey,
  expireTime: number,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: gatewayTokenAccount, isSigner: false, isWritable: true },
    { pubkey: gatekeeperAuthority, isSigner: true, isWritable: false },
    { pubkey: gatekeeperAccount, isSigner: false, isWritable: false },
  ];
  const data = GatewayInstruction.updateExpiry(expireTime).encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Add a feature to an existing Gatekeeper Network.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param payer The payer of the transaction (used to pay rent into the gatekeeper account)
 * @param network The gatekeeper network that the account is being added to.
 * @param feature The NetworkFeature Enum value
 */
export async function addFeatureToNetwork(
  payer: PublicKey,
  network: PublicKey,
  feature: NetworkFeature,
): Promise<TransactionInstruction> {
  const featureAccount = getFeatureAccountAddress(feature, network);

  const keys: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: network, isSigner: true, isWritable: false },
    { pubkey: featureAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const data = GatewayInstruction.addFeatureToNetwork(feature).encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Remove a feature to an existing Gatekeeper Network.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param payer The payer of the transaction (used to pay rent into the gatekeeper account)
 * @param network The gatekeeper network that the account is being added to.
 * @param feature The NetworkFeature Enum value
 */
export async function removeFeatureFromNetwork(
  payer: PublicKey,
  network: PublicKey,
  feature: NetworkFeature,
): Promise<TransactionInstruction> {
  const featureAccount = getFeatureAccountAddress(feature, network);

  const keys: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: network, isSigner: true, isWritable: false },
    { pubkey: featureAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const data = GatewayInstruction.removeFeatureFromNetwork(feature).encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * For a gatekeeper network that supports it, create an expireToken instruction,
 * that is to be signed by the gateway token owner.
 * @param gatewayTokenAccount
 * @param owner
 * @param gatekeeperNetwork
 */
export function expireToken(
  gatewayTokenAccount: PublicKey,
  owner: PublicKey,
  gatekeeperNetwork: PublicKey,
): TransactionInstruction {
  const feature = new NetworkFeature({
    userTokenExpiry: new UserTokenExpiry({}),
  });
  const featureAccount = getFeatureAccountAddress(feature, gatekeeperNetwork);
  console.log("featureAccount", featureAccount.toBase58());
  const keys: AccountMeta[] = [
    { pubkey: gatewayTokenAccount, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: featureAccount, isSigner: false, isWritable: false },
  ];
  const data = GatewayInstruction.expireToken(gatekeeperNetwork).encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Burn a gateway token.
 * Returns a Solana instruction that must be signed by the gatekeeper authority.
 * @param gatewayTokenAccount The gateway token to burn
 * @param gatekeeperAuthority The gatekeeper burning the token (must be in the same network as the issuing gatekeeper)
 * @param gatekeeperAccount The account in the gatekeeper network of the gatekeeper revoking the token
 * @param recipient The account to receive the SOL from the burn
 */
export function burn(
  gatewayTokenAccount: PublicKey,
  gatekeeperAuthority: PublicKey,
  gatekeeperAccount: PublicKey,
  recipient: PublicKey,
): TransactionInstruction {
  const keys: AccountMeta[] = [
    ...getStateChangeAccountMeta(
      gatewayTokenAccount,
      gatekeeperAuthority,
      gatekeeperAccount,
    ),
    { pubkey: recipient, isSigner: false, isWritable: true },
  ];
  const data = GatewayInstruction.burnToken().encode();
  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data,
  });
}

SCHEMA.set(GatewayInstruction, {
  kind: "enum",
  field: "enum",
  values: [
    ["addGatekeeper", AddGatekeeper],
    ["issue", Issue],
    ["setState", SetState],
    ["updateExpiry", UpdateExpiry],
    ["revokeGatekeeper", RevokeGatekeeper],
    ["addFeatureToNetwork", AddFeatureToNetwork],
    ["removeFeatureFromNetwork", RemoveFeatureFromNetwork],
    ["expireToken", ExpireToken],
    ["burnToken", BurnToken],
  ],
});
SCHEMA.set(AddGatekeeper, {
  kind: "struct",
  fields: [],
});
SCHEMA.set(Issue, {
  kind: "struct",
  fields: [
    ["seed", { kind: "option", type: [8] }],
    ["expireTime", { kind: "option", type: "u64" }],
  ],
});
SCHEMA.set(SetState, {
  kind: "struct",
  fields: [["state", GatewayTokenState]],
});
SCHEMA.set(UpdateExpiry, {
  kind: "struct",
  fields: [["expireTime", "u64"]],
});
SCHEMA.set(RevokeGatekeeper, {
  kind: "struct",
  fields: [],
});
SCHEMA.set(AddFeatureToNetwork, {
  kind: "struct",
  fields: [["feature", NetworkFeature]],
});
SCHEMA.set(RemoveFeatureFromNetwork, {
  kind: "struct",
  fields: [["feature", NetworkFeature]],
});
SCHEMA.set(ExpireToken, {
  kind: "struct",
  fields: [
    ["padding", { kind: "option", type: [8] }],
    ["gatekeeperNetwork", AssignablePublicKey],
  ],
});
SCHEMA.set(BurnToken, {
  kind: "struct",
  fields: [],
});
