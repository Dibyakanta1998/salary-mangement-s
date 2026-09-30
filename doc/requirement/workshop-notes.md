# Requirements workshop notes

- Date: 30 September 2026
- Participants: Business analyst; Priya Shah, HR Manager, ACME
- Purpose: lock v1 scope for salary management software before design or build

These notes are the conversation record. They are not the requirements sheet. A separate `requirements.md` will be written from this.

## Brief we started from

The assessment brief is thin. ACME has about 10,000 employees in several countries. Salary data lives in Excel, and that work is tedious. The HR Manager must manage salary data in web software and answer how the organization pays people. The first version is one HR user, not a full HRIS. Grading favors sound judgment over a large system. Engineering constraints were already fixed and were not debated: React, PostgreSQL, Sequelize, and Docker so one command starts the project. Docs live under `doc/`.

## What the analyst proposed first

The analyst opened with a brief the HR Manager could mark up. Assumptions were labeled as assumptions.

**Goal.** One place for the HR Manager to keep current salary data for about 10,000 employees and to answer, in the product, how ACME pays people, so the work stops living in Excel.

**Jobs.** Find one person and see current pay, currency, and since when. Correct a salary or the attributes that explain it. See base-pay spend and how it splits by country and department. Compare the same kind of role across countries. Narrow the workforce and read both the people and the numbers. See what changed recently so a meeting figure can be traced to an edit.

**In scope, as first proposed.**

- Employee directory: search by name or employee id; filter by country, department, and job title; open one person.
- Employee pay record: one current annual base, currency, and effective date; the HR Manager can edit and save. Assumption: one current salary, not a stack of historical rates.
- Pay overview: headcount, total annual base, and breakdowns by country and by department, each row opening as a filtered list.
- Comparison and slice: one job title (optional department) side by side by country, with headcount, average, median, min, and max; plus a filtered slice of people with the same summary stats.
- Change log: when, which employee, which field, previous value, new value, for the organization and for one person. Assumption: the only actor is the HR Manager.

**Questions the analyst wanted the product to answer.** How many people are we paying (one headcount). What is the annual base-pay bill (one total per currency, not a blended company total). Spend by country and by department (headcount, total, average). Typical pay for a job title by country (headcount, average, median, lowest, highest). Who is paid above or below an amount in a country and department (filtered list plus headcount, average, and total). What we pay this person and since when. What salary data changed recently (a list, not a chart). Bonus versus base, gender pay gap, compa-ratio, overtime, and next-quarter payroll cost were called out as questions for later.

**Fields the analyst proposed.** Required: employee id, one display name, country, department, job title, annual base, currency, pay effective date, and active status. Assumption: the seed is current employees only. Optional: hire date, employment type, city or site, manager name, cost center. Explicitly unknown, and not to be invented in the seed: pay frequency, allowances, bonus or commission, equity, grade or band, FTE, legal entity, gender, bank or tax or national id, and termination date or leavers.

**Out of scope, as first proposed.** Payroll processing, tax and statutory filings, approvals, login and SSO and roles, employee self-service, benefits and leave and time and overtime, offers and hiring and reviews, salary bands and market data, bonus and equity administration, full salary history and point-in-time reporting, live exchange rates and a group currency, Excel upload and download as a workflow, notifications and scheduled reports, and multi-country compliance packs.

**Eight defaults, if Priya was unsure.**

1. Pay is annual base only. Variable pay waits.
2. No blended reporting currency. Totals stay per currency.
3. Active employees only. Leavers are out of headcount and out of the pay bill.
4. Current rate plus an edit log. No “pay as of last March.”
5. Store annual base. If a source is monthly, convert with ×12 and say so on the record.
6. Breakdowns are country, department, and job title only.
7. Edit existing people, including pay. No hiring or termination. Deactivate is unnecessary if the seed is already the active population.
8. No gender or pay-equity cut. Do not collect demographic fields for the take-home.

The analyst also stated non-functional needs at requirements level only: usable at about 10,000 rows, search and filters in a couple of seconds, answers without export, an amount never shown without its currency, averages and totals never mixed across currencies, one current pay figure, an edit trace for pay, currency, country, department, job title, and effective date, honest empty states, last save wins, and answers refresh after a save. Over-scoping risks named in the room: a full HRIS, payroll or tax or approvals, roles and SSO, fake bands or forecasts, made-up exchange rates, effective-dated history before current-state edit works, Excel import and export as the product, and more reports than the eight questions.

## What Priya said she actually does

Priya Shah looks after pay data for about 10,000 people. She is not building a system. She told the analyst what she does and what she will refuse to click through. Simplification she stated: countries are India, the United States, the United Kingdom, Germany, and Singapore. Departments are Engineering, Sales, People, Finance, and Operations. Levels are L1 through L6. L1–L3 are individual contributors. L4–L6 are managers. She is not maintaining a job catalog.

**Her week.** Monday she opens the India workbook and the US workbook because Finance or the CHRO has already mailed her. She looks up one person, or she filters a country and a department and copies a table into a slide. Tuesday someone in the UK says a raise was applied in the wrong sheet. Wednesday a manager asks why two people with the same name show different pay, and one of them left last year but is still on the active tab. Thursday a transfer from Singapore to Germany is in three files with three currencies and no one agrees which date it happened. Friday she is reconciling a leaver who is still in the cost pivot. What breaks is not the math. The files disagree. Someone sorts a sheet and a currency column slides. A leaver stays active. A raise is typed into the India file for a person who already moved. She finds out when leadership quotes her number back and it is wrong.

**What salary means to her.** The number she trusts is annual gross base pay, in the currency of the country they work in. India is INR, the US is USD, the UK is GBP, Germany is EUR, Singapore is SGD. Monthly pay is that annual number divided by 12. She only wants it when someone in India or Germany asks, because that is how they talk. She does not want a monthly master record. Allowances are a second annual number, same currency, often blank. Target bonus is a percent of base, often blank. She does not store actual bonus paid. If leadership says “total cash,” she means base plus allowances plus base times target bonus percent, and she wants that formula visible. She called allowances, target bonus, and total cash nice later, not Monday.

**Fields she will not lose.** Employee id (she will not run this on names). Legal name. Country they work in. Currency, and it must match that country. Department. Level. Annual gross base. Status: active or left, plus the date they left. Manager’s employee id, which can be empty. Start date. Last pay change date. A short note on the last change, such as “annual increase” or “correction, was typed in USD by mistake.” She can live without photo, personal email, address, emergency contact, cost center, and job family trees.

**Monday questions.**

1. For one country, median annual base, headcount, and total annual base, active people only.
2. The same cut by department inside that country. Engineering in India is not Engineering in the US.
3. The same cut by level inside a country. L5 in Sales versus L5 in Engineering, still inside one country.
4. Who is outside the pay band for their country and level. Show the person, their base, the band min and max, and how far over or under. Where she has not set a band, say “no band.” Do not invent one.
5. Which departments cost the most in a country: headcount next to total annual base, sorted by cost. Highest paid teams means this, not a leaderboard of individuals.
6. What changed in the last 30 days: person, old base, new base, date, note. Raises, corrections, and leavers.
7. Find one person by id or by name and show current pay.

Average by country is a second number she can live with. She leads with median, because a few L6 packages make the average a liar. Gender pay gap is a twice-a-year board question she does herself. She wanted an optional gender field (Female, Male, or blank), no pay-gap dashboard, and a warning if the cut is incomplete. She will not open that on Monday. She dropped a global rich list that mixes currencies.

**Manage.** Add a person, with an id she types or pastes. She adds about ten to thirty people a week. Edit their pay. End employment: set them to left, keep the row, stop counting them in every total. Correct a mistake: change the number and force a note. Search one person and land on one row. No bulk salary editor. Export of the current filtered table is something she wants when Finance asks. She does not want to import a sheet back in. A country move and a raise are the same edit screen: new values, date, and note.

**History.** Current pay must be obviously current. She also needs the last few changes on that person: date, old base, new base, old country if it changed, note. A short list, maybe the last ten. She does not need every allowance change since 2014, and she does not need an audit novel.

**What she resents.** Approvals. Org-chart editing. She stores a manager id so she can answer who is on a team. She is not drawing boxes. Benefits. Tax. Payroll runs. Login roles and permission matrices for two people. Email notifications.

**How answers should look.** A table of people, with filters for country, department, level, and active or left. Above the table: headcount, median annual base, total annual base, and the currency of that total. If the filter crosses countries, do not add the money. Show separate totals per currency, or make her pick one country first. She would rather be blocked than shown a blended number. No dashboard, gauges, or “insights.” A bar of total base by department inside one country is acceptable because it answers where the money sits, and she called that bar nice-to-have. The table is the product.

**Dirty data.** Some people have no department. Let her save them and filter “missing department.” Some names repeat. Employee id is the identity, and the screen must show the id next to the name. Some people have no manager. Leave it blank. Do not invent a manager to save a salary. Currency must not be free-typed as “rupees” or “$”. Pick the country, currency follows. If a row has INR on a US employee, flag it. Do not silently convert.

**Must-haves she named.** One current record per employee id, with annual gross base, country, and matching currency. Active versus left, so leavers drop out of totals and stay searchable. Search one person and open their pay. Add, edit pay, correct with a required note, and end employment. Filters for country, department, level, and status, with headcount, median, and total in one currency. The same cuts by department and by level inside a country. Who is outside band, and a clear “no band” where she has not set one. A short history of pay and country changes on the person.

**Later, and she will not block launch.** Allowances and target bonus percent. A gender field. Export of the filtered table. The “missing department” filter. A single bar of cost by department inside one country.

## Where they disagreed

| Topic | Analyst first | Priya |
| --- | --- | --- |
| Create and end employment | Edit existing people only. No add. No ending employment. Seed is active employees only. | Add people (she types the id) and end employment. Leavers stay searchable and drop out of totals. |
| Job title vs level | Job title is required and is a breakdown. No level. | Level L1–L6 is the cut. Job title is not a field. No job catalog. |
| Department | Department is global, alongside country and job title. | Department only inside one country. Engineering in India is not Engineering in the US. |
| Bands | No bands. Inventing ranges would fake the analysis. | Outside-band, only where she has set a band. Otherwise say “no band.” |
| History | A field-level edit log of many fields. No required note. | Last ~10 pay and country changes, with a note. A 30-day list. Not a diary of every column. |
| Median vs average | Averages and totals. Median was on the job comparison, not the lead number. | Median is what she quotes. Average gets her in trouble in a staff meeting. |
| Currency | Currency is its own field. Totals stay per currency. Mismatches were not locked as unsavable. | Currency follows country. She first asked to flag a mismatch. She does not want free text such as “rupees,” and she never wants INR added to USD. |

## How each conflict closed

Priya was asked to lock seven points. She said yes to all of them.

1. **Yes, lock it.** Add employee and end employment are in. Leavers stay searchable and are excluded from money and headcount totals. A status filter can show them. If leavers stay in the money totals she will not trust a number on the screen.
2. **Yes, lock it.** Cuts are country, then department inside a country, then level inside a country. Job title is not a field. She asks about Engineering in India, not a global Engineering pile.
3. **Yes, lock A.** v1 has a simple table she edits: country + level to min and max annual base. “Outside band” only for cells she filled. Everyone else is “no band.” She said thirty cells is a list she already keeps. She will fill the ones she uses. Option B (bands wait) was rejected.
4. **Yes, lock it.** History is the last 10 changes on a person, plus a list of pay changes in the last 30 days. Not a full audit of every column. She needs the last few pay, country, and status changes, and a note when the money or the country changes.
5. **Yes, lock it.** Lead numbers are headcount, median annual base, and total annual base, per currency. Average is not on the main screen.
6. **Yes, lock the wait.** Allowances, target bonus, gender, spreadsheet export, and charts wait. The missing-department filter can wait too, as long as she can still save a person with no department.
7. **Yes, lock it.** Currency is chosen by country and not free-typed. The app never adds INR to USD.

The analyst then sized the same locks for a take-home and stated these decisions:

- Currency is not a free field with a warning. It is derived from country. A mismatch cannot be saved. Seed rows that break the map are data errors.
- “Last pay change date” and “note on last change” are not fields she edits. They come from the latest change.
- Level is required, with employee id, legal name, country, annual base, and status. A blank level would make the level cut and the band check dishonest.
- Leave date is required only when status is left. It stays empty for active people.
- The note is required to save an edit or to end employment. It is not required on create.
- The 30-day list is pay and country changes, plus end employment. Columns: person, old base, new base, date, note. If they left and base did not change, old and new base match and the note says so. Department, level, and name edits are not on that list.
- History is a change list, not effective dating. The person screen shows the last 10: date, old base, new base, old country if it changed, note. Older rows are kept so the 30-day list stays complete. No “pay as of March.”
- “Total cost” in v1 means total annual base.
- No average on screen. No cross-country median. With no country selected, show headcount and total base per currency only. Median appears only after one country is selected.
- L5 Sales versus L5 Engineering is not its own report. Same country, level L5, then the department table.
- Manager employee id and start date are stored and shown. No tree and no tenure view.
- Department is Engineering, Sales, People, Finance, Operations, or blank. No free-text department. Blank department can be saved. The missing-department filter waits.
- Bands are in, and small. One min and max annual base per country and level, at most 30. She sets them. The seed has none. If that country and level has no band, the cell says “no band.” “No band” is neither inside nor outside. Outside means active base strictly below min or above max. The list shows person, base, min, max, and distance in that currency. The same band applies to every department at that level. Empty bands are honest because she can set them. Inventing ranges in the seed would not be.

Priya closed with: “I can do my Monday with this.”

## Locked decisions

**In**

- Find a person by id or name. Id is always visible. Duplicate names are fine.
- Filters: country, department, level, status. Default status is active.
- Once a country is selected: headcount, median base, total base, and currency. Monthly base on the person only, as annual ÷ 12, not stored.
- Department table inside the selected country, sorted by total base, with headcount and median beside it.
- Level table inside the selected country, with the same three numbers. L5 Sales versus L5 Engineering is that country, level L5, then the department rows.
- Add a person (she types the id). Edit on one screen (raise, country move, level, department). End employment (row kept, dropped from headcount, median, and totals).
- Required note on edit and on end employment. Not required on create.
- Last 10 changes on the person. Last-30-days change list.
- Band table for country + level (at most 30), seeded empty, “no band” until she sets one. Outside-band list: person, base, min, max, distance. Same band for every department at that level.

**Out**

Payroll, tax, benefits, approvals, SSO, roles, email, org chart, job catalog, job title, bulk edit, import, average, blended total, rich list, pay gap, effective dating, dashboard.

**Later**

Allowances, target bonus, total cash, gender, export, missing-department filter, bar chart.

**Required fields**

- Employee id, unique
- Legal name
- Country
- Currency, derived from country
- Level L1–L6
- Annual gross base
- Status: active or left
- Leave date if left

**Optional**

- Department: Engineering, Sales, People, Finance, Operations, or blank
- Manager employee id (need not match a real person)
- Start date

**Change record**

Date, old base, new base, old country if changed, note required.

**Band**

Country, level, min, max.

**Countries**

India INR, United States USD, United Kingdom GBP, Germany EUR, Singapore SGD.

**Cross-currency rule**

Never sum across currencies. With no country selected, show per-currency headcount and total base only. No blended total and no cross-country median.

## Still open

Both parties said the scope is locked. Priya said she can do her Monday with this. No material product questions were left open.
