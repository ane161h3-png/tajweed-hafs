import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import SectionPage from './pages/SectionPage'
import SubsectionPage from './pages/SubsectionPage'
import About from './pages/About'
import NotFound from './pages/NotFound'
import { JuzList, SurahList } from './features/mushaf/MushafLists'
import MushafReader from './features/mushaf/MushafReader'
import MushafHome, { BookmarksPage, SearchPage } from './features/mushaf/MushafHome'
import AhkamSection from './features/ahkam/AhkamSection'
import AhkamHome from './features/ahkam/AhkamHome'
import LessonPage from './features/ahkam/LessonPage'
import {
  CommonMistakes, FindingMakhraj, GeneralMakharij, LetterPage, LettersGrid, SpecificMakharij, Teeth, Titles,
} from './features/makharij/MakharijPages'
import {
  LetterCards, LetterStrength, NonOppositeSifat, OppositeSifat, SifatMatrix, SimilarLetters,
} from './features/sifat/SifatPages'
import { OfflineAudio, ReciterLibrary } from './features/listen/ListenPages'
import { QuizLevel, QuizReview } from './features/quiz/QuizPages'
import { RecitePractice } from './features/quiz/Recite'
import { TasmeePage } from './features/quiz/Tasmee'
import { AttendanceCard, AttendancePage, PrintCards, ShareProgress, StudentDetail, Subscription, TeacherDashboard } from './features/teacher/TeacherPages'
import NotebookPage from './features/notebook/NotebookPage'
import NotebookBook from './features/notebook/NotebookBook'
import { AudioSettings, ColorSettings, DisplaySettings, ProgressSettings } from './features/settings/SettingsPages'

// المسارات المحددة (المصحف، عن البرنامج) قبل المسار العام للأقسام الفرعية.
// كل مرحلة تضيف صفحاتها هنا وتحلّ محل SubsectionPage لقسمها.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="notebook/book" element={<NotebookBook />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="mushaf" element={<MushafHome />} />
        <Route path="mushaf/surahs" element={<SurahList />} />
        <Route path="mushaf/juz" element={<JuzList />} />
        <Route path="mushaf/search" element={<SearchPage />} />
        <Route path="mushaf/bookmarks" element={<BookmarksPage />} />
        <Route path="mushaf/surah/:n" element={<MushafReader key="surah" kind="surah" />} />
        <Route path="mushaf/juz/:n" element={<MushafReader key="juz" kind="juz" />} />
        <Route path="ahkam" element={<AhkamHome />} />
        <Route path="ahkam/:subId" element={<AhkamSection />} />
        <Route path="ahkam/:subId/:lessonId" element={<LessonPage />} />
        <Route path="makharij/general" element={<GeneralMakharij />} />
        <Route path="makharij/specific" element={<SpecificMakharij />} />
        <Route path="makharij/letters" element={<LettersGrid />} />
        <Route path="makharij/letters/:id" element={<LetterPage />} />
        <Route path="makharij/titles" element={<Titles />} />
        <Route path="makharij/teeth" element={<Teeth />} />
        <Route path="makharij/finding" element={<FindingMakhraj />} />
        <Route path="makharij/mistakes" element={<CommonMistakes />} />
        <Route path="sifat/opposite" element={<OppositeSifat />} />
        <Route path="sifat/non-opposite" element={<NonOppositeSifat />} />
        <Route path="sifat/cards" element={<LetterCards />} />
        <Route path="sifat/matrix" element={<SifatMatrix />} />
        <Route path="sifat/strength" element={<LetterStrength />} />
        <Route path="sifat/similar" element={<SimilarLetters />} />
        <Route path="listen/reciters" element={<ReciterLibrary />} />
        <Route path="listen/offline" element={<OfflineAudio />} />
        <Route path="quiz/review" element={<QuizReview />} />
        <Route path="quiz/recite" element={<RecitePractice />} />
        <Route path="quiz/tasmee" element={<TasmeePage />} />
        <Route path="quiz/:subId" element={<QuizLevel />} />
        <Route path="teacher/share" element={<ShareProgress />} />
        <Route path="teacher/students" element={<TeacherDashboard />} />
        <Route path="teacher/students/:id" element={<StudentDetail />} />
        <Route path="teacher/card" element={<AttendanceCard />} />
        <Route path="teacher/attendance" element={<AttendancePage />} />
        <Route path="teacher/cards" element={<PrintCards />} />
        <Route path="teacher/subscription" element={<Subscription />} />
        <Route path="settings/display" element={<DisplaySettings />} />
        <Route path="settings/colors" element={<ColorSettings />} />
        <Route path="settings/audio" element={<AudioSettings />} />
        <Route path="settings/progress" element={<ProgressSettings />} />
        <Route path="settings/notebook" element={<NotebookPage />} />
        <Route path="settings/about" element={<About />} />
        <Route path=":sectionId" element={<SectionPage />} />
        <Route path=":sectionId/:subId" element={<SubsectionPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
