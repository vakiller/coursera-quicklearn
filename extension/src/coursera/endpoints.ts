export const ORIGIN = 'https://www.coursera.org';

const OUTLINE_FIELDS =
  'moduleIds,onDemandCourseMaterialModules.v1(name,slug,description,timeCommitment,lessonIds,optional,learningObjectives),' +
  'onDemandCourseMaterialLessons.v1(name,slug,timeCommitment,itemIds,optional),' +
  'onDemandCourseMaterialItems.v2(name,slug,timeCommitment,contentSummary,isLocked,lockableByItem,itemLockedReasonCode,trackId,lockedStatus,itemLockSummary)';

const enc = encodeURIComponent;

export const urls = {
  course: (slug: string) => `${ORIGIN}/api/onDemandCourses.v1?q=slug&slug=${enc(slug)}&fields=name,slug`,
  outline: (slug: string) =>
    `${ORIGIN}/api/onDemandCourseMaterials.v2/?q=slug&slug=${enc(slug)}&includes=modules,lessons,items&fields=${enc(OUTLINE_FIELDS)}&showLockedItems=true`,
  lectureVideo: (courseId: string, itemId: string) =>
    `${ORIGIN}/api/onDemandLectureVideos.v1/${enc(courseId)}~${enc(itemId)}?includes=video&fields=${enc('onDemandVideos.v1(sources,subtitles,subtitlesVtt,subtitlesTxt)')}`,
  supplement: (courseId: string, itemId: string) =>
    `${ORIGIN}/api/onDemandSupplements.v1/${enc(courseId)}~${enc(itemId)}?includes=asset&fields=${enc('openCourseAssets.v1(typeName),openCourseAssets.v1(definition)')}`,
};

/** The only API path prefixes the extension may ever request. Quiz/exam/assignment endpoints are deliberately absent. */
const ALLOWED_PATH_PREFIXES = [
  '/api/onDemandCourses.v1',
  '/api/onDemandCourseMaterials.v2/',
  '/api/onDemandLectureVideos.v1/',
  '/api/onDemandSupplements.v1/',
  '/api/subtitleAssetProxy.v1/',
];

export function isAllowedUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.origin !== ORIGIN) return false;
  return ALLOWED_PATH_PREFIXES.some((p) => u.pathname === p.replace(/\/$/, '') || u.pathname.startsWith(p));
}
