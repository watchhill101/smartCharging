import { AlipaySdk } from "alipay-sdk";

const alipayConfig = {
  appId: process.env.ALIPAY_APP_ID || "9021000151623353",
  privateKey:
    process.env.ALIPAY_PRIVATE_KEY ||
    "MIIEpQIBAAKCAQEAvCMDi9tplsT637Dzh6ZgfkkVcP6ZP3MdQPaMBqVjgXBgVS0HDIjHhUcq4tQUCZvVMxNSZLcG45KJRHWIhiwa6PQDc0xFOk9dVn+XebdlMRrwHLFkZTAvpLpz1+gaOkJ47eQb9yn/cX9J4THIlz9y33oAwb7Bfl0biOeaca06sdQvShZgtRcK32FmiSWN0gARsvzjmhY+dO3KTuJBxAL/pR0wUmwGdf7M/Y4QTQzEAvo7/+CUvSMJvvWoyEKNlUzrtQ2zrLda0lykotOsoCsvtUXHFflUaKPUYdwQM5xTX/m2KpzHwy/xyEQwOl3QnP550H3TZG/aemnFQPL5kCBNXQIDAQABAoIBAGPhTtusI7V4ZBvnzJJioO3KjQiNEfzed1Rqz9Ijcd1hNLNjkU91Oj+mlb0QjIbBZYGVK3Puu0iMHjXrFAzvU2YDTeWjQ0l+ovXuDRQAakeUno8NGliiKVkR57hjL7FoYt0g8jvY3xV5V1an4G9zrt+33Lj/NaiJc7nOA2+AYR3Qt05G5KclsKnfgSOT6tTktEJUmtEvhMVtHkJ02b15EW/JPzy+LyMDjaCcZjrTxo/Nk+yPSEXgLBsP/KguhsW1EsnG+2cDq+K2Sh5GihAzEnFHEQTtdOOqtHuSBw0q61gd2mENqgFjOrxYNuI3hKOi9Co1eMTMyTcR7pgsLqLK5wECgYEA78ogf6FTnhEVSDxlKQzx7L/8bpKLY58KpNARzlQF/DFtevacuKgqxIgi3POYYbyrt0e4C7slKBR1RWZucIq8AN62OZw8L1+E3xb4ruDvFnHoqoXIHU765FrUC8MJvH/nCoE6DRT3bBmk5A7ijMS8LTcK/RydNutprAJPRXGW4B0CgYEAyNr3uBvRUWTWM79IXOBP3PPv7jEiMqES5L/1nR31Jg6E13oRvun/Bv5GD0AZf1kxcyP8Q7fbzODlpfnzJEHvRwn6/sqy/n1XVcq3NSzdcXViuxKKINWpfuY0VCy/pQ+Ur8Z+KJ7VeljNHOZwtwmRDR13BhbtFw/7SB7XN4tmHkECgYEA5sy+ixpUyYfX3DeFhwWWtjH0XtleoPyr2gcLnHTzbdKFdh14q6PxxkjihZlRyoE3Jqo5U9FF6lYGqk31bw2Z95xl+P2QUGi4E6KgqnKGrivlrnwmKU+j3bgu8UNBU9YoI8xOe9j6bWohdAF/vc5+8WZRhV7NU9czVwTCGC1E82ECgYEAn52reKramBVLSEo9hllX/h340NBI/fUVH6YQ2PBCriChnt9KFO69lWAiauIkoRhPfNHfGi2VReZ/eXv9phWjwk+DIFITFryi1/HF0EM8I3sGn+Wm0VsaXFcyxKXfEpwkK9/QyBUZTyYcslfKwRqgI80DllpHxakUpwajP2fPGkECgYEAlW+wsWJ9KTA4IK/rCMKbTBphFrzNy3Wh7nqQXk6zyx7T+60FZ2XIQGD16lxQXvi2yK75Pfal2qS1H2krTo9THBiP0aeZqgZJY/zrJII3ZXx+USScLagemEFEdJp7ThOtAHNeeUKmGKhqXkiP5fkTrnO5KEoYhUksFHwhc0Z1NF4=",
  alipayPublicKey:
    process.env.ALIPAY_PUBLIC_KEY ||
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhZHbI6fgQnOHUxUbjq42bf6eNUHANx0Hl1p092OMzPARvMwAX1HzNnuZiYQKRMx86kL90+6MNVPG+vMqt2uNBXQB2BMZEkIX0129MV5X+rR7rJS66bEcTjmEA23SWVmquY8I/47TkxCA3d/28+CpkOOwFdelLRmxo68n7h3acnm2pZW3U4oXLYVhzl/6OOIdyWgAp7V5r4rDumisxe0v05pwwilo8/nYikOgNvT4V5cyOgauLnYWil/tTKQNcB9kKtcDKSZyLTyiwjrvAInCwbUd7F2Ont4vF+qVwffl6pC1kSLMM9P1gArQHhulhnayxd1hIZalB5ML1E771AeMmwIDAQAB",
  gateway:
    process.env.NODE_ENV === "production"
      ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
      : "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
};

export const alipaySdk = new AlipaySdk(alipayConfig);

//生成订单号
export const generateOrderNo = (
  type: "CHARGE" | "RECHARGE",
  userId: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${type}_${timestamp}_${userId.slice(-4)}_${random}`;
};
