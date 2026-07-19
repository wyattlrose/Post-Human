# Progress Photos

## Complete Photo Display

The original uploaded photos should never be modified. Only what is displayed to the user at runtime will be procedurally stretched and cropped.

### Dynamic Cropping Logic
A cropping percent value will define the percentage of additional vertical space to include in the display of the photo beyond the two y-landmarks covered
distances.
The width of the photo to display will be whatever width meets the poses aspect ratio requirements.
The origin of the crop will have a Y value that is the midpoint between the two y-landmarks, and an X value equal to the x-Landmark.

### Ordering

Photos should be ordered by angle:

- 90° Right
- 45° Right
- Front
- 45° Left
- 90° Left

## Persistence

### PROGRESS_PHOTO

#### Columns

| Column       | Data Type | Purpose                                                                 |
|--------------|-----------|-------------------------------------------------------------------------|
| PHOTO_ID     | INTEGER   | `PRIMARY_KEY`                                                           |
| DATE         | INTEGER   | Date photo taken as a Unix Timestamp                                    |
| pose_id      | INTEGER   | Maps photo to its `PROGRESS_POSE`                                       |
| ANGLE        | TEXT      | Maps photo to its `PROGRESS_ANGLE`                                      |
| EXTENSION    | TEXT      | Extension of the photo, combined with `PHOTO_ID` to get the photo file. |
| Y_LANDMARK_1 | REAL      |                                                                         |
| Y_LANDMARK_2 | REAL      |                                                                         |
| X_LANDMARK   | REAL      |                                                                         |

#### Constraints

| Constraint                      | Purpose                                           |
|---------------------------------|---------------------------------------------------|
| UNIQUE(date_id, pose_id, angle) | Ensures only one photo per date, pose, and angle. |

### PROGRESS_POSE

Each entry represents the pose the user has in the photo, as well as settings indicating how photos of this pose should be displayed

| Column           | Data Type | Purpose                                                                       |
|------------------|-----------|-------------------------------------------------------------------------------|
| pose_id          | INTEGER   | `PRIMARY_KEY`                                                                 |
| pose_name        | TEXT      | Display name, `UNIQUE`                                                        |
| cropping_percent | REAL      | Percent to show outside of each photos landmarks.                             |
| aspect_ratio     | REAL      | Aspect ratio of displayed photos                                              |
| y_landmark_1     | TEXT      | User defined text description describing what the landmark should align with. |
| y_landmark_2     | TEXT      | User defined text description describing what the landmark should align with. |
| x_landmark       | TEXT      | User defined text description describing what the landmark should align with. |
| collection_size  | INTEGER   | Photo size for vertical collection view.                                      |
| single_size      | INTEGER   | Photo size for horizontal single angle view.                                  |

### PROGRESS_ANGLE

| Column   | Data Type | Purpose                |
|----------|-----------|------------------------|
| ANGLE_ID | INTEGER   | `PRIMARY_KEY`          |
| ANGLE    | TEXT      | Display name, `UNIQUE` |