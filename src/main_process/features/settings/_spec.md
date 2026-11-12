### Implementation

#### Settings Interaction
Have only one exported method for getting settings.
Have only one exported method for updating settings.

#### Settings Writing
1. Write the updated settings to a temporary settings file
2. Once the write completes, rename the temporary file to be the settings file and overwrite the original.