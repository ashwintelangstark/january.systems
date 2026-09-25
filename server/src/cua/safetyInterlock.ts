/**
 * Safety Interlock & Failsafe Controller for Computer-Using Agent (CUA)
 */
export class SafetyInterlock {
  private static isHalted = false;

  public static halt(): void {
    SafetyInterlock.isHalted = true;
    console.warn('🚨 [SafetyInterlock] EMERGENCY HALT TRIGGERED! CUA actions aborted.');
  }

  public static resume(): void {
    SafetyInterlock.isHalted = false;
    console.log('✅ [SafetyInterlock] CUA resumed.');
  }

  public static checkHalt(): boolean {
    return SafetyInterlock.isHalted;
  }

  /**
   * Verifies if coordinates are safely within the physical screen boundaries
   */
  public static validateCoordinates(x: number, y: number, maxWidth = 3840, maxHeight = 2160): { x: number; y: number } {
    if (SafetyInterlock.isHalted) {
      throw new Error('CUA execution halted by SafetyInterlock.');
    }

    // Emergency fail-safe corner (0-10, 0-10)
    if (x <= 10 && y <= 10) {
      SafetyInterlock.halt();
      throw new Error('Emergency stop corner reached. CUA halted.');
    }

    const clampedX = Math.max(0, Math.min(maxWidth, Math.round(x)));
    const clampedY = Math.max(0, Math.min(maxHeight, Math.round(y)));
    return { x: clampedX, y: clampedY };
  }
}
