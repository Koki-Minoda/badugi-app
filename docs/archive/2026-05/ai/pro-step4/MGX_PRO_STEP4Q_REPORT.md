# MGX Pro Step4-Q Report

| Variant | Step4P Pro EV | Step4Q Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | STABLE |
| D01 | 13.9 | 13.9 | 16.1 | -2.1 | 0.0000 | PASS | STABLE |
| D02 | 9.2 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | STABLE |
| S01 | 8.0 | 8.0 | 22.0 | -14.0 | 0.0000 | PASS | STABLE |
| S02 | 4.7 | 4.9 | 25.1 | -20.3 | 0.0000 | PASS | IMPROVED_NOT_READY |

S02 focused `300-hand x 3 seed`:
- Step4P average: `Pro 8.5 / Standard 21.5 / Gap -13.0`
- Step4Q average: `Pro 9.0 / Standard 21.0 / Gap -12.1`

S02 full-suite `100-hand x 3 seed`:
- Step4P average: `Pro 4.7 / Standard 25.3 / Gap -20.7`
- Step4Q average: `Pro 4.9 / Standard 25.1 / Gap -20.3`

Conclusion:
- Step4-Q improves S02 slightly without reopening any weak/trash defense.
- Residual S02 gap is now mostly sparse multiway good-hand value capture, not inherited weak-hand continues.
