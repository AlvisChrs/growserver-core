import { Tile } from "../tile";
import type { Player } from "../../player";
import { handleSurgeryWrench } from "../../surgery/surgery-manager";

/**
 * Surgery Robot & Practice Patient Dummy (Surg-E #4296, Train-E #8558, Hospital Bed #1256).
 * Punching or wrenching initiates the surgery confirmation dialog.
 */
export class SurgeryRobotTile extends Tile {
  public override async onPunch(player: Player): Promise<boolean> {
    if (this.data.fg === 0) return true;
    handleSurgeryWrench(player, this.world, this.data.x, this.data.y, this.data.fg);
    return true;
  }

  public override async onWrench(player: Player): Promise<boolean> {
    if (this.data.fg === 0) return true;
    handleSurgeryWrench(player, this.world, this.data.x, this.data.y, this.data.fg);
    return true;
  }
}
