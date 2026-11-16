# Forever Market

An auction-house companion for **World of Warcraft: Forever**. Browse listings, follow prices over time, plan a shopping basket, and compare crafting costs with buying the finished item.

The interface supports English and Russian and works on desktop and mobile. It is an independent fan project, not affiliated with Blizzard Entertainment.

## What you can do

- Choose a region, ruleset and auction house; search items by name or ID, sort prices and save favorites.
- See the lowest buyout, quantity-weighted median, available units and listing count.
- Explore hourly price history for seven days and daily history for 90 days, with a chart and a table of observations.
- Compare the current minimum with recent snapshots and find hours that have historically had higher listed prices.
- Build a shopping basket and estimate the cost of buying a requested quantity from the available listings.
- Search a recipe, load its ingredients into the basket, and compare crafting with buying the finished item. You can also enter ingredients manually.
- Export the current item list as CSV. Favorites and the basket are stored in your browser.

Recipe search uses the public [Warcraft Forever data library](https://warcraftforever.com/developers/data/), which reports the source and client build with each response. It is a third-party dataset; missing results do not prove a recipe is absent in game. Selecting a recipe **replaces the current basket**. The calculator only includes ingredients with usable auction data; vendor prices, deposits, cooldowns and crafting fees are not included.

## Reading the numbers

Prices describe **active listings**, not confirmed sales. The cheapest item can be a single unusually priced listing. The quantity estimator takes offers in unit-price order and buys whole ordinary stacks; it can buy extra and does not guarantee the cheapest combination. Commodity listings are treated as divisible. Prices can change before you reach the auction house.

The craft comparison uses the current minimum price of the output as a hypothetical sale price and applies the fee you enter. It is not a guarantee that the item will sell. Item variants sharing an ID are grouped together.

The hour comparison needs at least three observations at the same UTC hour in the last seven days. It is based on listing minima, not sales. History starts accumulating when your collector first runs: existing historical prices are not imported.

## Run it on GitHub Pages

The static site and scheduled collector can run on GitHub Free in a **public** repository. GitHub Pages and standard hosted Actions runners have usage limits, so check GitHub's current terms if your traffic or data grows.

1. Create a Battle.net API client in the [Developer Portal](https://community.developer.battle.net/access/clients). The collector uses client credentials; visitors do not need to sign in to Battle.net.
2. Add two **repository secrets** under **Settings → Secrets and variables → Actions**:
   - `BNET_CLIENT_ID`
   - `BNET_CLIENT_SECRET`
3. In **Settings → Pages**, set the source to **GitHub Actions**.
4. Open **Actions → Collect market data**, select **Run workflow**, and wait for the deploy job. The job displays the site URL.

Keep the Client Secret in GitHub Secrets. Do not add it to the repository or enter it on the site.

Without credentials, the workflow publishes an explicitly labelled demo with fictional prices. After adding the secrets, rerun the workflow. The real Blizzard integration uses currently undocumented Forever endpoints and has not yet been verified with live credentials; endpoints or their responses may change.

The collector runs at minute 23 of every hour. GitHub may delay or skip scheduled runs. Each market shows its actual snapshot time and marks old data; failed requests preserve the last successful snapshot. A scheduled workflow in a public repository can be disabled after a period of repository inactivity.

EU, US, KR and TW are supported. China uses a separate platform and is not connected. The API currently may return identical houses for different rulesets; the interface includes house IDs so you can distinguish the feeds without assuming they are separate markets.

## Run locally

Requirements: Node.js 22+ and Python 3.12+. There are no third-party project dependencies.

```bash
npm test
npm run build
python3 -m http.server 3000 --directory dist
```

Open `http://localhost:3000`. An empty data directory opens the demo. To collect real prices locally, provide `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET` through your environment, then run:

```bash
python3 scripts/collect.py
npm run build
```

Optional variables: `REGIONS` defaults to `eu,us,kr,tw`; `MAX_NAME_LOOKUPS` defaults to `300`. Names and icons are loaded gradually. When Blizzard has no item name, the collector tries Wowhead’s Forever tooltip data; items absent from both sources remain as IDs. The browser also requests missing metadata for visible items from Wowhead and caches it locally; search by name only covers names loaded so far. Select an item in the market table to use it as a crafting output. `.env.example` documents variable names; the collector does not automatically load an `.env` file.

## Data and maintenance

The collector writes market summaries and price history to `web/data/`. GitHub Actions persists this data in a separate `market-data` branch between runs and deploys the static site from `dist/`. Back up that branch if the history matters to you. Git history can grow even though the application keeps seven days of hourly and 90 days of daily observations. The workflow stops if the built artifact reaches 900 MiB; reduce retention or region coverage if needed.

Listing depth is available only in snapshots collected after the depth feature was added. Older snapshots can still appear in the price chart but cannot produce a quantity quote. Recipe lookups happen in the browser against Warcraft Forever; the manual basket remains available when that service is unreachable. English item names from Blizzard are used when localized names are unavailable.

## Sources

- [Blizzard Forever API community notes](https://us.forums.blizzard.com/en/blizzard/t/wow-forever-api-what-works-so-far-plus-a-ts-client/60334)
- [Warcraft Forever game data library](https://warcraftforever.com/developers/data/)
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)

Code is available under the [MIT License](LICENSE). World of Warcraft and related marks belong to Blizzard Entertainment.

Auction feeds with the same faction name are combined per region and ruleset. Repeated auction IDs are counted once. Combined history starts with the first combined snapshot; original feed histories remain in the data branch. Category and required-level filters only match items with known metadata.

Deployment: pushes to main run Publish site using the latest market-data snapshot. Collect market data runs hourly or manually, then triggers Publish site after success. Metadata lookups use four workers; the collector logs region and metadata timings.
