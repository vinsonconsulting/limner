// Compose tool — wraps the Phase 4 compose tool (discriminated-union
// over the @limner/core compose facade's 17 ops) with a CMA-side
// handler. Image-returning ops upload to R2 + return URL; `decode`
// returns structured JSON; `cf*` ops pass through `env.IMAGES`.
//
// Refs: D-RA-12, D-RA-16

export {}; // populated in Step 4
