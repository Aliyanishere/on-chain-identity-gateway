import { Command, Flags } from "@oclif/core";
import { PublicKey } from "@solana/web3.js";
import {
  airdropFlag,
  clusterFlag,
  gatekeeperKeyFlag,
  gatekeeperNetworkPubkeyFlag,
  prioFeeFlag,
  skipPreflightFlag,
} from "../util/flags";
import { getTokenUpdateProperties } from "../util/utils";

export default class Refresh extends Command {
  static description = "Refresh a gateway token";

  static examples = [
    `$ gateway refresh EzZgkwaDrgycsiyGeCVRXXRcieE1fxhGMp829qwj5TMv 54000
Refreshed
`,
  ];

  static flags = {
    help: Flags.help({ char: "h" }),
    gatekeeperKey: gatekeeperKeyFlag(),
    gatekeeperNetworkKey: gatekeeperNetworkPubkeyFlag(),
    cluster: clusterFlag(),
    airdrop: airdropFlag,
    priorityFeeLamports: prioFeeFlag(),
    skipPreflight: skipPreflightFlag,
  };

  static args = [
    {
      name: "gatewayToken",
      required: true,
      description: "The gateway token to freeze",
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (input: string): Promise<PublicKey> => new PublicKey(input),
    },
    {
      name: "expiry",
      description:
        "The new expiry time in seconds for the gateway token (default 15 minutes)",
      default: 15 * 60 * 60, // 15 minutes
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (input: string): Promise<number> => Number(input),
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Refresh);

    const expiry = args.expiry as number;

    const { gatewayToken, gatekeeper, service } =
      await getTokenUpdateProperties(args, flags);

    this.log(`Refreshing:
     ${gatewayToken.toBase58()}
     by gatekeeper ${gatekeeper.publicKey.toBase58()}`);

    await service
      .updateExpiry(
        gatewayToken,
        expiry + Math.floor(Date.now() / 1000)
      )
      .then((t) => t.send(flags.skipPreflight ? {skipPreflight: true}: {}))
      .then((t) => t.confirm());

    this.log("Refreshed");
  }
}
