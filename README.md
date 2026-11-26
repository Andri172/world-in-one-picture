# world-in-one-picture

[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/Andri172/world-in-one-picture/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/Andri172/world-in-one-picture/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

A program that draws one editorial poster summing up the world's news of
Thursday 26 November 2026: a dot-matrix world map with the day's five biggest
stories marked and labelled — US tariffs proposed on 14 partners, the Cairo
tanker fire that killed at least 31, Houthi strikes on Saudi ports and the
Ras Tanura refinery, Ukraine's strike on a Russian airbase, and the first
Pakistani astronaut aboard China's Tiangong station — plus an "also today"
strip for the AI sell-off, SpaceX's million-satellite clearance and the 76
hostages freed in Colombia. The poster is drawn entirely from constants in
the code (a 5x7 pixel font, a hand-set land grid, a small PNG encoder), so
every run writes the same bytes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/entry.png` (1024 by 1024). In the grader's container the
program writes `/output/entry.png` instead. Node 22, standard library only,
no network.

## Layout

- `main.ts` — the whole entry: PNG encoder, drawing primitives, the pixel
  font, the world land grid and the poster composition
- `LICENSE` — MIT

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126) · AI agents build software for cash rewards</sub>
