# personal video application

## Project Goal
create an application which can play videos present in a given folder.
It should be capable of play next, previous video button.
Videos suggestions for user to allow user to choose next videos like youtube.
Volume control pannel.
it should run regardless of system and driver.
User should be able to add video by video upload from local system.
User should be able to add video by providing youtube url and it will download this video from youtube to its video folder described in the starting.




## Login requirement

It should have login feature in order to personalize the video



## Volume control pannel
User can low and high the volume

## Adding new video
It should be capable of adding video in the user account by uploading it from local system


## Adding video by downloading it from a given you tube url
It should be capable of  adding video with the funcationality such that user can provide youtube link and it will download it from there

## Tech Stack

### Backend

-   Spring Boot 3
-   Spring security
- spring data jpa
-  MySQL latest
-  FFmpeg
-  yt-dlp
-   Maven
-   Lombok
-   REst API

### Frontend

React + HTML5 Video Player

------------------------------------------------------------------------

## Functional Requirements

### R1:video application

-   need user login from mysql at externally exposed port 3040 
    username root1 password Dzee2015$

-   sign in and signup only on email id Continue only if authenticated.



### R2: add video feature
  
- add video either by upload 
- add video by downldin from a youtube url  
  

## Build & Run

### One-command build (Windows)

.codex`\build`{=tex}.cmd

Output: target/monitor-0.0.1-SNAPSHOT.jar

------------------------------------------------------------------------

## Acceptance Criteria

-   Toggle recalculates dynamically.
-   Proper error handling implemented.
