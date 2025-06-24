import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where
} from 'firebase/firestore';

// Define context for Firebase and Auth
const FirebaseContext = createContext(null);

// Firebase Configuration and Initialization
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null); // Firebase user object
  const [userProfile, setUserProfile] = useState(null); // Custom user profile from Firestore
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('auth'); // State for navigation

  useEffect(() => {
    // Initialize Firebase app only once
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const authentication = getAuth(app);

    setDb(firestore);
    setAuth(authentication);

    // Sign in with custom token or anonymously
    const initialAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(authentication, __initial_auth_token);
          console.log('Signed in with custom token.');
        } else {
          await signInAnonymously(authentication);
          console.log('Signed in anonymously.');
        }
      } catch (error) {
        console.error('Firebase authentication error:', error);
        alert('Authentication failed: ' + error.message + '. Please ensure authentication methods are enabled in your Firebase console (Authentication > Sign-in method).');
      } finally {
        setLoading(false);
      }
    };

    initialAuth();

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(authentication, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && firestore) {
        const userProfileRef = doc(firestore, `artifacts/${appId}/users/${currentUser.uid}/profiles`, currentUser.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        if (userProfileSnap.exists()) {
          setUserProfile(userProfileSnap.data());
          if (userProfileSnap.data().role === 'admin') {
            setCurrentPage('adminDashboard');
          } else {
            setCurrentPage('studentDashboard');
          }
        } else {
          setUserProfile(null);
          setCurrentPage('registerProfile');
        }
      } else {
        setUserProfile(null);
        setCurrentPage('auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || !db || !auth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading application...</div>
      </div>
    );
  }

  const renderPage = () => {
    if (!user) {
      return <AuthPage auth={auth} db={db} setCurrentPage={setCurrentPage} />;
    } else if (!userProfile) {
      return <ProfileSetupPage auth={auth} db={db} setUserProfile={setUserProfile} setCurrentPage={setCurrentPage} />;
    } else {
      switch (currentPage) {
        case 'studentDashboard':
          return <StudentDashboard db={db} auth={auth} userProfile={userProfile} setCurrentPage={setCurrentPage} />;
        case 'adminDashboard':
          return <AdminDashboard db={db} auth={auth} userProfile={userProfile} setCurrentPage={setCurrentPage} />;
        case 'auth':
        case 'registerProfile':
          if (userProfile.role === 'admin') return <AdminDashboard db={db} auth={auth} userProfile={userProfile} setCurrentPage={setCurrentPage} />;
          return <StudentDashboard db={db} auth={auth} userProfile={userProfile} setCurrentPage={setCurrentPage} />;
        default:
          return (
            <div className="text-center p-4">
              <h2 className="text-2xl font-bold">Page Not Found</h2>
              <button
                onClick={() => userProfile.role === 'admin' ? setCurrentPage('adminDashboard') : setCurrentPage('studentDashboard')}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Go to Dashboard
              </button>
            </div>
          );
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setCurrentPage('auth');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <FirebaseContext.Provider value={{ db, auth, user, userProfile }}>
      <div className="min-h-screen bg-gray-100 font-inter">
        <header className="bg-gradient-to-r from-emerald-600 to-green-800 p-4 shadow-md flex justify-between items-center rounded-b-lg">
          <h1 className="text-white text-2xl md:text-3xl font-bold">Kisii National Polytechnic Exam Reg.</h1>
          <nav>
            {userProfile && (
              <div className="flex items-center space-x-4">
                <span className="text-white text-sm md:text-base">
                  Welcome, {userProfile.name} ({userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)})
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
                >
                  Logout
                </button>
              </div>
            )}
          </nav>
        </header>
        <main className="p-4 md:p-8">
          {renderPage()}
        </main>
      </div>
    </FirebaseContext.Provider>
  );
}

// AuthPage Component for Login/Signup
function AuthPage({ auth, db, setCurrentPage }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage('Logged in successfully!');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage('Account created successfully! Please set up your profile.');
        setCurrentPage('registerProfile');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div className="flex justify-center items-center py-10">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">{isLogin ? 'Login' : 'Sign Up'}</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</div>}
        {message && <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-sm">{message}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition duration-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition duration-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-emerald-600 hover:text-emerald-800 font-semibold transition duration-200"
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ProfileSetupPage Component for new users
function ProfileSetupPage({ auth, db, setUserProfile, setCurrentPage }) {
  const { user } = useContext(FirebaseContext);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState(''); // Only for students
  const [role, setRole] = useState('student'); // Default role
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!user) {
      setError("User not authenticated.");
      return;
    }

    try {
      const userProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profiles`, user.uid);
      const profileData = {
        email: user.email,
        name,
        role,
        uid: user.uid,
        ...(role === 'student' && { studentId }),
        createdAt: serverTimestamp(),
      };
      await setDoc(userProfileRef, profileData);
      setUserProfile(profileData);
      setMessage('Profile created successfully!');
      if (role === 'admin') {
        setCurrentPage('adminDashboard');
      } else {
        setCurrentPage('studentDashboard');
      }
    } catch (err) {
      console.error('Error creating profile:', err);
      setError(err.message);
    }
  };

  return (
    <div className="flex justify-center items-center py-10">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Complete Your Profile</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</div>}
        {message && <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-sm">{message}</div>}
        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="name">Full Name:</label>
            <input
              type="text"
              id="name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="role">Role:</label>
            <select
              id="role"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">Student</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          {role === 'student' && (
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="studentId">Student ID:</label>
              <input
                type="text"
                id="studentId"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required={role === 'student'}
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Create Profile
          </button>
        </form>
      </div>
    </div>
  );
}

// StudentDashboard Component
function StudentDashboard({ db, auth, userProfile, setCurrentPage }) {
  const [exams, setExams] = useState([]);
  const [studentRegistrations, setStudentRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('availableExams');
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => {
    const examsCollectionRef = collection(db, `artifacts/${appId}/public/data/exams`);
    const unsubscribeExams = onSnapshot(examsCollectionRef, (snapshot) => {
      const fetchedExams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExams(fetchedExams);
    }, (error) => console.error("Error fetching exams:", error));

    const registrationsCollectionRef = collection(db, `artifacts/${appId}/public/data/registrations`);
    const q = query(registrationsCollectionRef, where("studentId", "==", userProfile.studentId));
    const unsubscribeRegistrations = onSnapshot(q, (snapshot) => {
      const fetchedRegistrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudentRegistrations(fetchedRegistrations);
    }, (error) => console.error("Error fetching student registrations:", error));

    return () => {
      unsubscribeExams();
      unsubscribeRegistrations();
    };
  }, [db, userProfile]);

  const handleRegisterExam = async (examId) => {
    const registrationRef = collection(db, `artifacts/${appId}/public/data/registrations`);
    const existingRegistration = studentRegistrations.find(reg => reg.examId === examId);

    if (existingRegistration) {
      alert("You have already registered for this exam or your registration is pending/paid.");
      return;
    }

    try {
      await addDoc(registrationRef, {
        studentId: userProfile.studentId,
        studentName: userProfile.name,
        examId: examId,
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      alert('Successfully registered for the exam. Please proceed to payment.');
      setSelectedExamId(examId);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error registering for exam:', error);
      alert('Failed to register for the exam. Please try again.');
    }
  };

  const handleSimulatePayment = async () => {
    setPaymentMessage('');
    if (!selectedExamId) {
      setPaymentMessage('No exam selected for payment.');
      return;
    }

    const registrationToUpdate = studentRegistrations.find(reg =>
      reg.examId === selectedExamId && reg.studentId === userProfile.studentId
    );

    if (!registrationToUpdate) {
      setPaymentMessage('No pending registration found for this exam.');
      return;
    }

    try {
      const regDocRef = doc(db, `artifacts/${appId}/public/data/registrations`, registrationToUpdate.id);
      await updateDoc(regDocRef, {
        status: 'paid',
        paymentTimestamp: serverTimestamp(),
      });
      setPaymentMessage('Payment simulated successfully! Your registration is now paid.');
      setShowPaymentModal(false);
      setSelectedExamId(null);
    } catch (error) {
      console.error('Error simulating payment:', error);
      setPaymentMessage('Failed to simulate payment. Please try again.');
    }
  };

  const registeredExamsWithDetails = studentRegistrations.map(reg => {
    const examDetails = exams.find(exam => exam.id === reg.examId);
    return { ...reg, examDetails };
  }).filter(reg => reg.examDetails);

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Student Dashboard</h2>
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('availableExams')}
          className={`px-6 py-3 text-lg font-semibold transition-colors duration-300 ease-in-out ${
            activeTab === 'availableExams' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Available Exams
        </button>
        <button
          onClick={() => setActiveTab('myRegistrations')}
          className={`ml-4 px-6 py-3 text-lg font-semibold transition-colors duration-300 ease-in-out ${
            activeTab === 'myRegistrations' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          My Registrations
        </button>
      </div>

      {activeTab === 'availableExams' && (
        <div>
          <h3 className="text-2xl font-semibold text-gray-700 mb-4">Exams for Registration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.length > 0 ? (
              exams.map((exam) => (
                <div key={exam.id} className="bg-emerald-50 p-6 rounded-lg shadow-md border border-emerald-200 transform transition-transform duration-300 hover:scale-[1.02]">
                  <h4 className="text-xl font-bold text-emerald-800 mb-2">{exam.name}</h4>
                  <p className="text-gray-700 mb-1"><strong>Course Code:</strong> {exam.courseCode}</p>
                  <p className="text-gray-700 mb-1"><strong>Description:</strong> {exam.description}</p>
                  <p className="text-gray-700 mb-1"><strong>Fee:</strong> KES {exam.fee.toLocaleString()}</p>
                  <p className="text-red-600 text-sm mb-4"><strong>Deadline:</strong> {exam.registrationDeadline && new Date(exam.registrationDeadline.toDate()).toLocaleDateString()}</p>
                  <button
                    onClick={() => handleRegisterExam(exam.id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                  >
                    Register for this Exam
                  </button>
                </div>
              ))
            ) : (
              <p className="col-span-full text-gray-600 text-center">No exams available for registration at the moment.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'myRegistrations' && (
        <div>
          <h3 className="text-2xl font-semibold text-gray-700 mb-4">My Exam Registrations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {registeredExamsWithDetails.length > 0 ? (
              registeredExamsWithDetails.map((registration) => (
                <div key={registration.id} className="bg-green-50 p-6 rounded-lg shadow-md border border-green-200 transform transition-transform duration-300 hover:scale-[1.02]">
                  <h4 className="text-xl font-bold text-green-800 mb-2">{registration.examDetails.name}</h4>
                  <p className="text-gray-700 mb-1"><strong>Course Code:</strong> {registration.examDetails.courseCode}</p>
                  <p className="text-gray-700 mb-1"><strong>Status:</strong> <span className={`font-semibold ${registration.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>{registration.status.toUpperCase()}</span></p>
                  <p className="text-gray-700 mb-1"><strong>Fee:</strong> KES {registration.examDetails.fee.toLocaleString()}</p>
                  <p className="text-gray-700 text-sm">Registered On: {registration.timestamp && new Date(registration.timestamp.toDate()).toLocaleDateString()}</p>
                  {registration.status === 'pending' && (
                    <button
                      onClick={() => { setSelectedExamId(registration.examId); setShowPaymentModal(true); }}
                      className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                      Simulate Payment
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="col-span-full text-gray-600 text-center">You have no exam registrations yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-xl shadow-3xl w-full max-w-md border border-gray-200 animate-fade-in-up">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Simulate Payment</h3>
            {paymentMessage && <div className="bg-emerald-100 text-emerald-700 p-3 rounded-md mb-4 text-sm">{paymentMessage}</div>}
            <p className="text-gray-700 mb-6">
              You are simulating payment for:{' '}
              <span className="font-semibold">
                {exams.find(exam => exam.id === selectedExamId)?.name}
              </span> with a fee of{' '}
              <span className="font-semibold">
                KES {exams.find(exam => exam.id === selectedExamId)?.fee.toLocaleString()}
              </span>.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => { setShowPaymentModal(false); setSelectedExamId(null); setPaymentMessage(''); }}
                className="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-md transition duration-300 ease-in-out"
              >
                Cancel
              </button>
              <button
                onClick={handleSimulatePayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AdminDashboard Component
function AdminDashboard({ db, auth, userProfile, setCurrentPage }) {
  const [exams, setExams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('manageExams'); // 'manageExams' or 'viewRegistrations'

  // State for new/editing exam form
  const [examName, setExamName] = useState('');
  const [examCourseCode, setExamCourseCode] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examFee, setExamFee] = useState('');
  const [examDeadline, setExamDeadline] = useState(''); // Date string
  const [editingExamId, setEditingExamId] = useState(null); // ID of exam being edited

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const examsCollectionRef = collection(db, `artifacts/${appId}/public/data/exams`);
    const unsubscribeExams = onSnapshot(examsCollectionRef, (snapshot) => {
      const fetchedExams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExams(fetchedExams);
    }, (err) => console.error("Error fetching exams for admin:", err));

    const registrationsCollectionRef = collection(db, `artifacts/${appId}/public/data/registrations`);
    const unsubscribeRegistrations = onSnapshot(registrationsCollectionRef, (snapshot) => {
      const fetchedRegistrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistrations(fetchedRegistrations);
    }, (err) => console.error("Error fetching registrations for admin:", err));

    return () => {
      unsubscribeExams();
      unsubscribeRegistrations();
    };
  }, [db]);

  const resetForm = () => {
    setExamName('');
    setExamCourseCode('');
    setExamDescription('');
    setExamFee('');
    setExamDeadline('');
    setEditingExamId(null);
    setMessage('');
    setError('');
  };

  const handleAddOrUpdateExam = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!examName || !examCourseCode || !examDescription || !examFee || !examDeadline) {
      setError('All fields are required.');
      return;
    }
    const fee = parseFloat(examFee);
    if (isNaN(fee) || fee <= 0) {
      setError('Fee must be a positive number.');
      return;
    }
    const deadlineDate = new Date(examDeadline);
    if (isNaN(deadlineDate.getTime())) {
      setError('Invalid registration deadline date.');
      return;
    }

    try {
      const examData = {
        name: examName,
        courseCode: examCourseCode,
        description: examDescription,
        fee: fee,
        registrationDeadline: deadlineDate,
        lastUpdated: serverTimestamp(),
      };

      if (editingExamId) {
        const examDocRef = doc(db, `artifacts/${appId}/public/data/exams`, editingExamId);
        await updateDoc(examDocRef, examData);
        setMessage('Exam updated successfully!');
      } else {
        examData.createdAt = serverTimestamp();
        await addDoc(collection(db, `artifacts/${appId}/public/data/exams`), examData);
        setMessage('Exam added successfully!');
      }
      resetForm();
    } catch (err) {
      console.error('Error adding/updating exam:', err);
      setError('Failed to save exam. ' + err.message);
    }
  };

  const handleEditExam = (exam) => {
    setEditingExamId(exam.id);
    setExamName(exam.name);
    setExamCourseCode(exam.courseCode);
    setExamDescription(exam.description);
    setExamFee(exam.fee.toString());
    if (exam.registrationDeadline && exam.registrationDeadline.toDate) {
      const date = exam.registrationDeadline.toDate();
      setExamDeadline(date.toISOString().split('T')[0]);
    }
    setMessage('');
    setError('');
  };

  const handleDeleteExam = async (examId) => {
    if (window.confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/exams`, examId));
        setMessage('Exam deleted successfully!');
      } catch (err) {
        console.error('Error deleting exam:', err);
        setError('Failed to delete exam. ' + err.message);
      }
    }
  };

  const getStudentNameForRegistration = (studentId) => {
    const reg = registrations.find(r => r.studentId === studentId);
    return reg ? reg.studentName : 'Unknown Student';
  };

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Administrator Dashboard</h2>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('manageExams')}
          className={`px-6 py-3 text-lg font-semibold transition-colors duration-300 ease-in-out ${
            activeTab === 'manageExams' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Manage Exams
        </button>
        <button
          onClick={() => setActiveTab('viewRegistrations')}
          className={`ml-4 px-6 py-3 text-lg font-semibold transition-colors duration-300 ease-in-out ${
            activeTab === 'viewRegistrations' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          View Registrations
        </button>
      </div>

      {activeTab === 'manageExams' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Exam Form */}
          <div className="bg-gray-50 p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">{editingExamId ? 'Edit Exam' : 'Add New Exam'}</h3>
            {message && <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-sm">{message}</div>}
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</div>}
            <form onSubmit={handleAddOrUpdateExam} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="examName">Exam Name:</label>
                <input type="text" id="examName" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" value={examName} onChange={(e) => setExamName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="examCourseCode">Course Code:</label>
                <input type="text" id="examCourseCode" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" value={examCourseCode} onChange={(e) => setExamCourseCode(e.target.value)} required />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="examDescription">Description:</label>
                <textarea id="examDescription" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" rows="3" value={examDescription} onChange={(e) => setExamDescription(e.target.value)} required></textarea>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="examFee">Fee (KES):</label>
                <input type="number" id="examFee" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" value={examFee} onChange={(e) => setExamFee(e.target.value)} required min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="examDeadline">Registration Deadline:</label>
                <input type="date" id="examDeadline" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500" value={examDeadline} onChange={(e) => setExamDeadline(e.target.value)} required />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                >
                  {editingExamId ? 'Update Exam' : 'Add Exam'}
                </button>
                {editingExamId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Existing Exams List */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Existing Exams</h3>
            <div className="space-y-4">
              {exams.length > 0 ? (
                exams.map((exam) => (
                  <div key={exam.id} className="bg-emerald-50 p-4 rounded-lg shadow-sm border border-emerald-100 flex justify-between items-center transform transition-transform duration-300 hover:scale-[1.01]">
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-800">{exam.name} ({exam.courseCode})</h4>
                      <p className="text-gray-700 text-sm">Fee: KES {exam.fee.toLocaleString()} | Deadline: {exam.registrationDeadline && new Date(exam.registrationDeadline.toDate()).toLocaleDateString()}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditExam(exam)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-md text-sm shadow-sm transition duration-300 ease-in-out"
                        title="Edit Exam"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                          </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-md text-sm shadow-sm transition duration-300 ease-in-out"
                        title="Delete Exam"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-600 text-center">No exams created yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'viewRegistrations' && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">All Student Registrations</h3>
          <div className="overflow-x-auto">
            {registrations.length > 0 ? (
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider border-b">Student Name</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider border-b">Student ID</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider border-b">Exam Name</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider border-b">Course Code</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider border-b">Status</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider border-b">Registered On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registrations.map((reg) => {
                    const exam = exams.find(e => e.id === reg.examId);
                    return (
                      <tr key={reg.id} className="hover:bg-gray-50 transition-colors duration-200">
                        <td className="py-3 px-4 whitespace-nowrap text-gray-800">{reg.studentName}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-gray-800">{reg.studentId}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-gray-800">{exam ? exam.name : 'Unknown Exam'}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-gray-800">{exam ? exam.courseCode : 'N/A'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${reg.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {reg.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-gray-800">{reg.timestamp && new Date(reg.timestamp.toDate()).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-600 text-center py-4">No student registrations yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App; // Explicitly export App as the default component
