
### Exposed Methods

* The date picker always displays and accepts dates as `DD-MM-YYYY`; years must contain four digits.
* Setting and getting the selected date: should be done via a number representing a unix timestamp in seconds
* Setting and getting the max allowed date: should be done via a number representing a unix timestamp in seconds
* If the input has no preconfigured maximum, it defaults to today's local date at midnight; set `max` only to override that default.
* Setting and getting the minimum allowed date: should be done via a number representing a unix timestamp in seconds
