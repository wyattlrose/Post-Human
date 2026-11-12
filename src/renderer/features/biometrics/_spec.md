# Weight

## User Experience Design

I want to visualize:

* The users weight changes over a lifetime, to feel fulfilled and motivated by progress as a whole.
* The users weight changes over a large but not lifelong period, to assess they've been doing the last 3 months, 6 months, or year.
* The "Current Effort": The users weight changes from a set starting point until now, to track how a cut or bulk cycle is going.

Visual design:

* The lifetime and long-term views (1 year, 6 months) should allow me to add "life events" to the chart
* Weight change over time should be relative to the users birthday, they are the yearly intervals
* The user should be able to define an upper and lower bound weight target, their ideal BMI range

## Technical Design

## Layout

### Header

At the top of the page should be the header. This will contain the buttons that define the date range the user would like to see.

1. Time Range Segmented Control Button: A button with the following mutually exclusive options:

* Life Time Button: The complete span of time the user has input biometric data, the time range starts from the earliest inputted biometric data to today's
  date.
* Past Year Button: The time range to display is 364 days in the past up until today's date.
* Past 6 months button: The time range to display is 182 days in the past up until today's date.
* Past 3 months button: The time range to display is 91 days in the past up until today's date.
  Values: "L", "12M", "6M", "3M"

2. An "Effort" Dropdown: The user can select from all prior efforts and what will be displayed will be the start date of that inputted user effort until today's
   date or the next efforts start date if an effort exists that begins after the selected effort.

3. A "New Effort" button: This does not adjust the current selected date but merely triggers display of the Effort Editor.

### Effort Editor

When the user selects an effort view OR selects to create a new effort, they should be shown an additional row of buttons below the header that allows for
editing that efforts settings.

1. Dropdown - Effort type: All effort types should be listed with their text representations from EFFORT_TYPE.
2. Date Picker - Start Date: User selects the start date that the effort begins.
3. Text Input - Description: User can input the description of the effort.

### Weight Chart

Below the header should be the weight chart. This should span the full horizontal width of its available space.

## Component Details

### Weight Chart

#### X-Axis

* The minimum unit interval the X-Axis should support is 7 days.
* The max unit interval the X-Axis should support is 364 days.
* Unit intervals should scale by 7 days (7-day, 14-day, 21-day interval, etc.)
* The minimum time range to support display of is 7 days.
* The maximum time range to support display of is 29120 days.
* Date Format: 'DD-MM-YY'

##### Unit Scaling Logic

The chart should strive to maintain 14 X-Axis intervals on the display.
Whatever unit gets nearest to 14 X-Axis intervals without going over 14 intervals is the unit to display.

#### Y-Axis

* The minimum unit interval the Y-Axis should support is .1KG.
* The maximum unit interval the Y-Axis should support is 5KG.
* Unit intervals should scale by .1KG (.1KG, .2KG, .3Kg interval, etc.)
* The minimum weight range to support display of is 0KG.
* The maximum weight range to support display of is 700KG.
* Weight Format: '00.0', '00' if interval is whole number.

##### Unit Scaling Logic

The chart should strive to maintain 10 X-Axis intervals on the display.
Whatever unit gets nearest to 10 X-Axis intervals without going over 10 intervals is the unit to display.

#### Current Effort Display In The Chart

When viewing any of the time range options, the start of current efforts should be marked on the chart.
The current effort will be marked in the chart as a vertical line using the root chart palette color of the effort, shared with its label border, glow, and dropdown swatch:

* Cut: Coral red (`--chart-effort-cut-color`, `#FF7C5B`)
* Maintain: Yellow (`--chart-effort-maintain-color`, `#FFD034`)
* Bulk: Green (`--chart-effort-bulk-color`, `#72C674`)

Chart accents and neutral chart roles, including label and tooltip colors, are also derived from the root `--chart-*` palette in `global.css`.

Each effort's full description is displayed on the same horizontal line in a dedicated area above the plot, ideally centered over its line. Use 12px medium-weight, softly bright text with 6px horizontal padding in a 26px label row. Shift labels left as needed to avoid the plot's right edge and neighboring labels. If this would push the first label within 5px of the left edge, shift it right to retain that inset and push its neighbors right as needed. Adjacent labels retain a small visible gap. If all labels cannot fit within the plot at their natural widths, preserve the full descriptions and gap even though they extend beyond the right edge. Each label has a bottom border matching its effort line's color and thickness, aligned with the plot's upper edge.

Only one chart item is highlighted at a time. When the user mouses over an effort's line or its description, the line and description's bottom border gain a matching faint glow, the description text brightens over a very faint neutral background, and the data-point highlight and tooltip are hidden. Moving away from the effort allows normal data-point hover to resume.

Clicking an effort marker or its description with the primary mouse button should select that effort, just like selecting it from the Effort dropdown. The chart should immediately show the selected effort's date range, and the dropdown and effort editor should reflect the selection.

#### Interaction

* When mousing over the chart, the plot point nearest to the mouse (taking into consideration only the mouses position along the x-axis) should be highlighted
  and the weight and exact date value associated with that plot point should be displayed above.
* The date text in the tooltip should be darker than the weight text. Center the text in the tooltip, use a subtle translucent white outline and dark shadow, and use doubled padding with a 6px gap between the date and weight rows.

## Database Design

### CURRENT_EFFORT

| Column      | Data Type | Description                            |
|-------------|-----------|----------------------------------------|
| Start Date  | INTEGER   | Start date of the effort               |
| Type        | INTEGER   | Foreign key to `EFFORT_TYPE`           |
| Description | TEXT      | User defined description of the effort |

### EFFORT_TYPE

Starts with 3 default values:

(1,"Bulk")
(2,"Cut")
(3,"Maintain")

| Column | Data Type | Description                        |
|--------|-----------|------------------------------------|
| KEY    | INTEGER   | Primary key of effort type         |
| Text   | TEXT      | Text representation of effort type |

## Settings Design

```json
{
  "idealWeightUpperBound": 90,
  "idealWeightLowerBound": 80
}
```

**idealWeightUpperBound**: The upper bound of the users ideal weight range in KG. 
**idealWeightLowerBound**: The lower bound of the users ideal weight range in KG.
