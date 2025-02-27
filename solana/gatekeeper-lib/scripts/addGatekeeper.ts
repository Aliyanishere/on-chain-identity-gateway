import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SOLANA_COMMITMENT } from "../src/util/constants";
import { GatekeeperNetworkService } from "../src";
import { homedir } from "os";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mySecretKey = require(path.join(
  homedir(),
  ".config",
  "solana",
  // gatekeeper network key
  "gatbGF9DvLAw3kWyn1EmH5Nh1Sqp8sTukF7yaQpSc71.json" //"id.json"
));
const myKeypair = Keypair.fromSecretKey(Buffer.from(mySecretKey));

const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  SOLANA_COMMITMENT
);

const service = new GatekeeperNetworkService(connection, myKeypair);

const gatekeeperAuthority = new PublicKey(
  "civQnFJNKpRpyvUejct4mfExBi7ZzRXu6U3hXWMxASn"
); //Keypair.generate().publicKey;

(async function () {
  const gatekeeperAccount = await service.addGatekeeper(gatekeeperAuthority).then(sendableDataTx => sendableDataTx.data());

  console.log(gatekeeperAccount.toBase58());
})().catch((error) => console.error(error));
