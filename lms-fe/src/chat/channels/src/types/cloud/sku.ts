export type BillingDetails = {
    address: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    name: string;
    agreedTerms?: boolean;
    company_name?: string;
};

export const areBillingDetailsValid = (
    billingDetails: Omit<BillingDetails, 'card'> | null | undefined,
): boolean => {
    if (billingDetails == null) {
        return false;
    }

    return Boolean(
        billingDetails.address &&
      billingDetails.city &&
      billingDetails.state &&
      billingDetails.country &&
      billingDetails.postalCode &&
      billingDetails.name,
    );
};
