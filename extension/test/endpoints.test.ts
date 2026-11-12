import { readFileSync } from 'node:fs';
import { urls, isAllowedUrl } from '../src/coursera/endpoints';
import { parseSubtitleUrls } from '../src/coursera/parse';

describe('isAllowedUrl', () => {
  it('allows the course, outline, video, reading and subtitle endpoints', () => {
    expect(isAllowedUrl(urls.course('x'))).toBe(true);
    expect(isAllowedUrl(urls.outline('x'))).toBe(true);
    expect(isAllowedUrl(urls.lectureVideo('c', 'i'))).toBe(true);
    expect(isAllowedUrl(urls.supplement('c', 'i'))).toBe(true);
    const subs = parseSubtitleUrls(JSON.parse(readFileSync('test/fixtures/lecture-video.json', 'utf8')));
    expect(isAllowedUrl(subs.en!)).toBe(true);
  });

  it('blocks quiz, exam, assignment and foreign hosts', () => {
    expect(isAllowedUrl('https://www.coursera.org/api/onDemandExamSessions.v1/abc')).toBe(false);
    expect(isAllowedUrl('https://www.coursera.org/api/quizzes.v1/abc')).toBe(false);
    expect(isAllowedUrl('https://www.coursera.org/api/onDemandProgrammingAssignments.v1/abc')).toBe(false);
    expect(isAllowedUrl('https://www.coursera.org/api/onDemandStaffGradedAssignments.v1/abc')).toBe(false);
    expect(isAllowedUrl('https://evil.com/api/onDemandCourseMaterials.v2/?q=slug')).toBe(false);
    expect(isAllowedUrl('https://www.coursera.org.evil.com/api/onDemandCourseMaterials.v2/')).toBe(false);
    expect(isAllowedUrl('not a url')).toBe(false);
  });
});
