export class IdGeneratorUtil {
  public static generateTransactionId(prefix = 'TX'): string {
    const timestamp = Date.now();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}_${timestamp}_${random}`;
  }

  public static generateTripProductId(hotelCode: string): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `NMO-PRD-${today}-${randomNum}-${hotelCode.slice(0, 4)}-${randomHex}`;
  }

  public static generateBookingLocator(): string {
    const randomNum = Math.floor(1000000 + Math.random() * 9000000);
    return `NMO-BK-${randomNum}`;
  }

  public static generateSupplierConfirmation(): string {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `HTL-CONF-${randomNum}`;
  }

  public static generateCancellationReference(): string {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `NMO-CNC-${randomNum}`;
  }
}
