import { airdropTo, GatekeeperNetworkService } from "@identity.com/solana-gatekeeper-lib";
import { Command, Flags } from "@oclif/core";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  airdropFlag,
  clusterFlag,
  gatekeeperKeyFlag,
  gatekeeperNetworkKeyFlag,
  prioFeeFlag,
  skipPreflightFlag,
} from "../util/flags";
import { getConnectionFromEnv } from "../util/utils";

export default class AddGatekeeper extends Command {
  static description = "Add a gatekeeper to a network";

  static examples = [
    `$ gateway add-gatekeeper tgky5YfBseCvqehzsycwCG6rh2udA4w14MxZMnZz9Hp
`,
  ];

  static flags = {
    help: Flags.help({ char: "h" }),
    gatekeeperKey: gatekeeperKeyFlag(),
    gatekeeperNetworkKey: gatekeeperNetworkKeyFlag(),
    cluster: clusterFlag(),
    airdrop: airdropFlag,
    priorityFeeLamports: prioFeeFlag(),
    skipPreflight: skipPreflightFlag,
  };

  static args = [
    {
      name: "address",
      required: true,
      description: "The address of the gatekeeper to add to the network",
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (input: string): Promise<PublicKey> => new PublicKey(input),
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AddGatekeeper);

    const gatekeeper: PublicKey = args.address as PublicKey;
    const gatekeeperNetwork = flags.gatekeeperNetworkKey as Keypair;
    this.log(`Adding:
      gatekeeper ${gatekeeper.toBase58()} 
      to network ${gatekeeperNetwork.publicKey.toBase58()}`);

    const connection = getConnectionFromEnv(flags.cluster);

    if (flags.airdrop) {
      await airdropTo(
          connection,
          gatekeeperNetwork.publicKey,
          flags.cluster as string
      );
    }

    const networkService = new GatekeeperNetworkService(
      connection,
      gatekeeperNetwork
    );
    const gatekeeperAccount = await networkService
      .addGatekeeper(gatekeeper, flags.priorityFeeLamports ? { priorityFeeMicroLamports: flags.priorityFeeLamports } : undefined)
      .then((t) => t.send(flags.skipPreflight ? {skipPreflight: true}: {}))
      .then((t) => t.confirm());
    this.log(
      `Added gatekeeper to network. Gatekeeper account: ${
        gatekeeperAccount
          ? gatekeeperAccount?.toBase58()
          : "//GatekeeperAccount was undefined//"
      }`
    );
  }
}
