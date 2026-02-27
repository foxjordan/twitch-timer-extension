export const RULES = {
  bits: { per: 100, add_seconds: 60 },               // 100 bits -> +60s
  sub:  { '1000': 300, '2000': 600, '3000': 900 },   // tier1/2/3 -> 5/10/15 min
  resub: { base_seconds: 300 },                      // treat like sub
  gift_sub: { per_sub_seconds: 300 },                // each gift -> +5 min
  charity: { per_usd: 60 },                          // $1 -> +60s
  hypeTrain: { multiplier: 2.0 },                    // double during hype
  bonusTime: { multiplier: 2.0, stackWithHype: false }, // manual bonus multiplier
  follow: { enabled: false, add_seconds: 600 },       // optional: follow -> +10 min
  thirdPartyTip: { per_unit: 60, min_amount: 1 }      // 1.00 donated -> +60s, min 1.00 to trigger
};
