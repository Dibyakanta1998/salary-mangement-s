# Salary management requirements

One HR manager looks after pay for about 10,000 people in five countries. Today that work sits in spreadsheets that disagree. This product is the place to keep current base pay and to answer how the organisation pays people.

It is for that one person. It does not pay anyone, and it does not replace a full HR system.

## What “pay” means

The number that matters is **annual gross base pay**, in the currency of the country where the person works.

Monthly pay is the annual amount divided by 12, shown to two decimal places, half up. It is only a display. It is not stored, and it is not a second salary.

| Country | Currency |
| --- | --- |
| India | INR |
| United States | USD |
| United Kingdom | GBP |
| Germany | EUR |
| Singapore | SGD |

Choosing the country sets the currency. The currency cannot be typed. An amount from one country is never added to an amount from another. There is no exchange rate and no single company total.

## The people on file

Every person has:

- An employee id the HR manager types. Spaces at the ends are removed. What remains is stored as typed, including capitals, from 1 to 64 characters. Two ids that differ only by capital letters are two people. A duplicate is refused and does not overwrite anyone. The id cannot be changed later.
- A legal name, required, stored with surrounding spaces removed. The same name may belong to more than one person. The id is always shown next to the name.
- A country from the list above, and the currency that goes with it.
- A level from L1 to L6. L1–L3 are individual contributors. L4–L6 are managers. There is no job title.
- An annual base of zero or more, with at most two decimal places.
- A status of active or left. Someone who has left stays on file and can still be found. They drop out of headcount, median, and totals.

Optional, and a save is allowed when they are empty:

- Department: Engineering, Sales, People, Finance, or Operations. Not free text. Blank is allowed.
- Manager employee id. It does not have to match a real person.
- Start date, as a calendar date if it is filled in.

Leave date is required when someone is left, and it must be a calendar date. It is cleared when they are active. The product does not check leave date, start date, or today against each other.

There is no delete. Ending employment is how someone leaves the active numbers.

## Finding someone and keeping the record current

The HR manager can search by employee id or by name and open one person.

The people table can be filtered by country, department, level, and status. Status defaults to active. The table follows all four filters, so choosing “left” shows people who have left.

From one screen the HR manager can:

- Add a person.
- Change pay, country, level, or department.
- Mark someone as left. The row stays. They leave the active numbers.
- Mark someone as active again. The leave date is cleared, and they count again.

A country move is one save. The HR manager types the new annual base in the new country’s currency. The old amount is not converted.

## How the organisation pays

These are the questions the product answers. There is no dashboard and no average. Median is the number used in the room, because a few senior packages make an average misleading.

**No country selected.** One line for each currency that still has at least one matching active person: headcount and total annual base. No median. Department and level filters narrow those lines. The department and level tables stay hidden until a country is chosen.

**A country is selected.** Three figures, labeled as active people, in that country’s currency:

- headcount
- median annual base
- total annual base

The department table and the level table use the same active people, still limited by the department and level filters. Each row shows headcount, median, and total base. Departments are sorted by total base, highest first. Levels that remain run from L1 to L6. A department or level with nobody is left off the table.

People with no department appear as their own row when there is at least one of them. The country headcount equals the sum of the department rows, including that blank row, and it equals the sum of the level rows.

Comparing two departments at the same level is a filter, not a separate report. Pick the country and the level, then read the department rows.

**Median.** Only active people, in the selected country, inside the department and level filters. Sort their base pay. If the count is odd, the median is the middle value. If even, it is the midpoint of the two middle values, shown half-up to two decimal places. One person means that person’s base. Nobody means headcount 0, total 0, and a blank median.

The status filter does not change these figures. It only changes the people table. The figures stay on active people.

**Outside the band.** For a country and a level, the HR manager can set a minimum and a maximum annual base. There are at most 30 of these, one per country and level, and the same band applies to every department at that level. Both amounts are required, zero or more, at most two decimal places, in that country’s currency, and the minimum cannot be above the maximum. Until both are set, the cell is **no band**. Clearing a band removes both amounts and returns it to no band.

Someone is outside only when they are active and their base is strictly below the minimum or strictly above the maximum. Sitting on the minimum or the maximum is not outside. No band means they are neither inside nor outside. The list shows the person, their base, the minimum, the maximum, and the gap, and it says whether they are under or over. The gap is the plain difference in that currency.

Changing or clearing a band is not a change to a person’s pay, so it does not ask for a note and does not appear in their history.

## What is remembered

The current base on the person is the current base. Last change date and last note come from the latest remembered change. They are not fields of their own.

One save writes at most one history line, and only when:

- annual base changes
- country changes
- employment ends
- a left person is set back to active

Adding a person writes nothing. Changing only the name, department, level, manager, or start date writes nothing and does not ask for a note. A save that changes nothing writes nothing.

When a history line is written, a note is required. The line records the date, the old base, the new base, the old country if the country changed, and the note. If pay did not change, the old and new base are the same. A country move shows the old amount with the old country and the new amount with the new country.

The person shows the last 10 of these lines. Older lines stay stored. The last 30 days has its own list of pay changes, country moves, and employment changes. It does not include name, department, or level edits, and it is not a view of “what we paid last March.”

## Starting data

The first load has about 10,000 people, all five countries, every level, and every department. Some people have no department, no manager, or no start date. At least two people share a legal name and have different ids. Some people have left, with a leave date, and can still be found. Every row follows the rules above. Bands start empty.

Inside the last 30 days there is at least one pay change, one country move, and one end of employment, each with a note. Someone who has a change inside those 30 days also has an earlier change from before that window, so their own history shows both and the 30-day list shows only the newer one.

## Left out on purpose

These are not forgotten. They are out because they would not help the Monday questions, or because they would make the numbers less trustworthy.

- Payroll, tax, benefits, approvals, email, sign-in roles, and single sign-on. One person maintains the data. This product does not pay people.
- Job titles, a job catalog, and an org chart. Pay is cut by level, and by department inside one country. A manager id is only a note on the person.
- Averages, a blended company total, and a global list of the highest paid. Median is the figure to quote, and mixed currencies must not be added.
- Allowances, target bonus, a gender field, spreadsheet export, charts, and a special filter for missing department. Blank department can already be saved, and it already appears as a row. The rest can wait.
- Bulk edit and spreadsheet import. That is how the current files get corrupted.
- A full history of every field, and any report of pay as it stood on a past date. The last 10 changes, and the last 30 days, are enough to see what just moved.
- Invented bands or exchange rates. An empty band stays “no band” until the HR manager sets it.
