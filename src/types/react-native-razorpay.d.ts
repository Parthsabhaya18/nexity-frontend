declare module 'react-native-razorpay' {
  const RazorpayCheckout: {
    /** Resolves with `razorpay_payment_id` + signature; rejects with `{ code, description }`. */
    open(options: Record<string, unknown>): Promise<Record<string, string>>;
  };
  export default RazorpayCheckout;
}
