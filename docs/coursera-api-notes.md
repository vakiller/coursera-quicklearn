# Coursera API notes (Phase 0, 2026-11-11)

Probed with `curl` against `project-initiation-google`, **without login**. All endpoints are internal/unofficial.

## Outline — `onDemandCourseMaterials.v2` (public)

```
GET https://www.coursera.org/api/onDemandCourseMaterials.v2/?q=slug&slug=<slug>
  &includes=modules,lessons,items
  &fields=moduleIds,onDemandCourseMaterialModules.v1(name,slug,description,timeCommitment,lessonIds,optional,learningObjectives),
          onDemandCourseMaterialLessons.v1(name,slug,timeCommitment,itemIds,optional),
          onDemandCourseMaterialItems.v2(name,slug,timeCommitment,contentSummary,isLocked,lockableByItem,itemLockedReasonCode,trackId,lockedStatus,itemLockSummary)
  &showLockedItems=true
```

- `elements[0].id` = **courseId** (e.g. `mYs5UAp9Eeuh2QpCvqFzYQ`), `elements[0].moduleIds` = module order.
- `linked["onDemandCourseMaterialModules.v1"]`: `id, name, slug, description, timeCommitment(ms), lessonIds, learningObjectives` — **learningObjectives are only IDs**; no endpoint found that resolves them (`learningObjectives.v1`, `onDemandLearningObjectives.v1` → route does not exist). → use `description`.
- `linked["onDemandCourseMaterialLessons.v1"]`: `id, name, moduleId, itemIds` (order).
- `linked["onDemandCourseMaterialItems.v2"]`: `id, name, slug, timeCommitment(ms), isLocked, contentSummary.typeName`.
  - typeName seen: `lecture` (definition.duration ms), `supplement` (definition.assetTypeName = `cml`), `ungradedAssignment`, `staffGraded` (Module Challenge = graded), `ungradedWidget`.
  - Practice "Test your knowledge" = `ungradedAssignment`; graded = `staffGraded` (also expect `exam`, `quiz`, `gradedProgramming` etc. elsewhere).
  - `isLocked` is `true` for assignments even when browsing anonymously.
- Total items in this course: 85.

## Video — `onDemandLectureVideos.v1` (public for this course)

```
GET https://www.coursera.org/api/onDemandLectureVideos.v1/<courseId>~<itemId>?includes=video&fields=onDemandVideos.v1(sources,subtitles,subtitlesVtt,subtitlesTxt)
```
- `linked["onDemandVideos.v1"][0].subtitlesVtt` = `{lang: "/api/subtitleAssetProxy.v1/<id>?expiry=..&hmac=..&fileExtension=vtt"}` — **relative URL**, same host.
- Languages present: ar, de, en, es, fr, hi, id, ja, ko, pt-BR, tr, uk, **vi**.
- VTT: standard `WEBVTT`, numbered cues, `HH:MM:SS.mmm`, multi-line cue text, no speaker tags seen.

## Reading — `onDemandSupplements.v1`

```
GET https://www.coursera.org/api/onDemandSupplements.v1/<courseId>~<itemId>?includes=asset&fields=openCourseAssets.v1(typeName),openCourseAssets.v1(definition)
```
- `linked["openCourseAssets.v1"][0].definition.value` = CML string starting `<co-content>`.
- Tags seen (29 readings): `text` (opt `variant`), `strong`, `em`, `u`, `a href`, `heading level=1..3` (opt `variant`), `list bulletType=bullets|numbers` + `li`, `img assetId` (**no URL**), `asset id name extension assetType`. No tables seen.
- **Exemplar readings return HTTP 403 `{"errorCode":"Not Authorized"}`** when anonymous (unlocked only after submitting the activity). → per-item 403 = locked, not session expiry.
- Course glossary reading links to a Google Doc template + a docx asset (content not inline).

## Auth

Outline, videos, subtitles and most readings worked without cookies. The content script still fetches with `credentials: 'include'` so locked/paid items work when logged in.

## Quiz

Not probed (by design).
