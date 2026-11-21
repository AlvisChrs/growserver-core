import { generateShopWorld } from "../game/world/generation/shop";
import { encodeWorldFile, decodeWorldFile } from "../game/world/world-manager";
import { WorldDB } from "../database/services/world-db";

async function main() {
  const data = generateShopWorld();
  console.log("Generating with weather:", data.weather);
  const buffer = encodeWorldFile(data);
  await WorldDB.writeBinary("SHOP", buffer);

  // Verification read-back
  const readBack = await WorldDB.readBinary("SHOP");
  if (!readBack) throw new Error("failed to read back shop.bin");
  const decoded = decodeWorldFile(readBack);
  console.log(`SHOP world successfully generated and saved! Total blocks: ${decoded.blocks.length}, file size: ${buffer.length} bytes, weather: ${decoded.weather?.id}`);
  let bedrockCount = 0;
  let dirtCount = 0;
  for (const b of decoded.blocks) {
    if (b.fg === 8) bedrockCount++;
    if (b.fg === 2) dirtCount++;
  }
  console.log(`Stats -> Bedrock: ${bedrockCount}, Dirt: ${dirtCount}`);
}

main().catch(console.error);
