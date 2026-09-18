import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/** 결제 키가 없으면 null. 이 경우 결제는 "모의 결제" 모드로 동작한다. */
export const stripe = key ? new Stripe(key) : null;

export const billingEnabled = Boolean(key);
