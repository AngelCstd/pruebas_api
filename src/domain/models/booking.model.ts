export interface BookingResult {
  bookingLocator: string;
  supplierConfirmationCode: string;
  clientReference: string;
  creationDate: string;
  bookingStatus: string;
  totalPrice: { amount: number; currency: string };
  hotelInformation: { hotelCode: string; hotelName: string; checkIn: string; checkOut: string };
}
