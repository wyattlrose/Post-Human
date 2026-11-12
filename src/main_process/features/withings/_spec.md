## Technical Design Doc

### Behavior

#### Token Refresh Logic

On the startup call for withings data, if the token is expired then it can be refreshed on startup.

#### Data Refresh Logic

##### Auto Refresh

On startup, a check should be made to see if the withings settings `lastUpdate` value is a time that is earlier than the start of the current hour. If the
`lastUpdate` value is missing from the settings entirely, act as though it has a value of 0.

If the `lastUpdate` value is earlier than the current hour, a fresh call should be made to withings for data using the current 'lastUpdate' value.

IF the call for data successfully completes, the `lastUpdate` value should be updated to the time in which a call was *started* to withings for data.
If the call fails, make no change to the stored `lastUpdate` value.

FOR NOW: No surfacing any UI alerts if the call fails.

##### Button Trigger Refresh

Allows for an immediate call for more withings data on click. `lastUpdate` value updates should follow the same logic as during auto refresh of data.

FOR NOW: No surfacing any UI alerts if the call fails.

##### Data Priority

Withings data should overwrite existing data.

### Settings

```json
withings: {
  "oauth": {
    client_id: '<id>',
    client_secret: '<secret>',
    api_endpoint: '<withings API endpoint>'
  },
  "token": {
    user_id: '<withings user ID>',
    access_token: '<access token>',
    refresh_token: '<refresh token>',
    expires_at: '<Unix timestamp in seconds>'
  },
  "lastUpdate": '<Unix timestamp in seconds>'
}
```

lastUpdate: Represents the most recent call for data made to withings. Calls to withings for more data should use this value as
the `lastupdate` value in calls to the withings API for measures. See #data-refresh-logic logic above for details.
