# UI revamp

## Goal

One shell on every page, with the same four screens. Layout and table chrome change. Behavior does not.

## Shell

Sticky white header, 14 units tall, content width `max-w-7xl`. Left link is People (`/`). Right nav is People (`/`), Changes (`/changes`) with a muted “30 days”, and Bands (`/bands`). The current item is `bg-slate-100 font-medium`. The rest are `text-slate-600` and lighten on hover. Add a person (`/people/new`) is a filled slate-900 button.

Page background is `bg-slate-100`, small type, antialiased. The page title is an `h1` in the main column, not in the header. Main is `max-w-7xl` with the same horizontal padding as the header.

Controls share one height, border, and sky focus ring. Tables sit on white rounded cards: uppercase small headers, slate header background, numeric columns right-aligned with tabular figures, row hover, no zebra.

Visible strings stay in `apps/web/src/copy.ts`.

## Home

Filter bar sticks under the header. On a large screen it is one row: Search, Country, Department, Level, Status. The status label notes that it affects the list only. There is no Search button. Selects still apply on change. Search still applies on Enter.

No country: one white card per currency, showing the code, headcount, and total with that currency. No median. No department or level tables.

With a country: three cards, Headcount, Median, and Total. A null median is an em dash. Under that, department and level tables sit in a left rail about 26rem on extra-large screens, and the people table sits on the right. Below that width the two breakdowns can sit side by side and the people table is full width.

The people card has the pager on top: total, page, previous, next. Previous and next are bordered buttons. Columns stay Employee, Country, Level, Department, Annual base, Status. Employee is the id on the first line and the name on the second, one link, no underline. Annual base stays right-aligned with its currency. Status is a small pill.

Loading, error with retry, and an empty list stay, inside the same white cards.

## Person

Same header. The form is a white card, two columns from the small breakpoint up, max width `3xl`. Read-only id, currency, and monthly use a slate-50 box. Monthly still prints `monthlyBase` through the existing formatter. The note field appears only when the form already shows it. History is a table of Date, What changed, and Note, still the last 10. No delete.

## Changes

Same header and table chrome. Person is two lines of text, id then name. Old base and new base stay right-aligned, each with its own currency code.

## Bands

The thirty open forms become a 5-country by 6-level grid. A cell shows the range, or “No band”. Clicking a cell selects it with a sky ring. One editor sits under the grid: country, level, currency, minimum, maximum, and Set. Clear is there only when a band exists. The outside list is a table under that editor, only when a band exists. A minimum above the maximum still shows the API error and does not save. Country names stay encoded in the path as they are now.

## What stays the same

The API is unchanged. Filters are still search, country, department, level, and status. Status still defaults to active, still filters the people list only, and is still omitted from the figures request. Amounts still go through `formatAmount` and still show the currency code. Monthly pay is still the server `monthlyBase`. No charts, no Redux, and no component library.
