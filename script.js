// تهيئة Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// استبدل القيم أعلاه بإعدادات Firebase الخاصة بمشروعك من Firebase Console
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// بيانات التطبيق
const appData = {
    classes: [],
    teachers: [],
    currentTeacher: null,
    currentClass: null,
    currentSection: null,
    currentDay: null,
    currentPeriod: null,
    currentSubject: null,
    selectedTeacher: null,
    weekOffset: 0,
    adminCredentials: {
        username: 'admin',
        password: 'admin123',
        isTemporary: true
    },
    schoolInfo: {
        educationDepartment: '',
        schoolName: ''
    }
};

// دالة لجلب التاريخ الهجري من API بناءً على التاريخ الميلادي
async function getHijriDateForDay(weekDayIndex, weekOffset = appData.weekOffset) {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = weekDayIndex - currentDay + (weekOffset * 7);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    const day = String(targetDate.getDate()).padStart(2, '0');
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const year = targetDate.getFullYear();
    const gregorianDate = `${day}-${month}-${year}`;

    try {
        const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${gregorianDate}`);
        const data = await response.json();

        if (data.code === 200) {
            const hijriData = data.data.hijri;
            return {
                day: parseInt(hijriData.day),
                month: hijriData.month.ar,
                year: parseInt(hijriData.year),
                formatted: `${hijriData.day} ${hijriData.month.ar} ${hijriData.year}`
            };
        } else {
            throw new Error('فشل في جلب التاريخ الهجري');
        }
    } catch (error) {
        console.error('خطأ في جلب التاريخ الهجري:', error);
        return {
            day: 1,
            month: "غير معروف",
            year: 1446,
            formatted: "1 غير معروف 1446"
        };
    }
}

// دالة لتحويل التاريخ الميلادي إلى هجري
async function convertToHijri(gregorianDate) {
    const [year, month, day] = gregorianDate.split('-').map(Number);
    const formattedDate = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
    try {
        const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${formattedDate}`);
        const data = await response.json();
        if (data.code === 200) {
            const hijriData = data.data.hijri;
            return {
                day: parseInt(hijriData.day),
                month: hijriData.month.ar,
                year: parseInt(hijriData.year),
                formatted: `${hijriData.day} ${hijriData.month.ar} ${hijriData.year}`
            };
        }
    } catch (error) {
        console.error('خطأ في تحويل التاريخ:', error);
        return null;
    }
}

// دالة لعرض التنبيهات الداخلية
function showInternalAlert(message) {
    const alertContainer = document.getElementById('internal-alert-container');
    alertContainer.textContent = message;
    alertContainer.classList.remove('hidden');
    setTimeout(() => {
        alertContainer.classList.add('hidden');
    }, 3000);
}

// دالة حفظ البيانات في Firestore
async function saveData() {
    try {
        await db.collection('appData').doc('main').set(appData);
        console.log('تم حفظ البيانات في Firestore');
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
        showInternalAlert('حدث خطأ أثناء حفظ البيانات');
    }
}

// دالة تحميل البيانات من Firestore
async function loadData() {
    try {
        const doc = await db.collection('appData').doc('main').get();
        if (doc.exists) {
            const data = doc.data();
            appData.classes = data.classes || [];
            appData.teachers = data.teachers || [];
            appData.adminCredentials = data.adminCredentials || {
                username: 'admin',
                password: 'admin123',
                isTemporary: true
            };
            appData.schoolInfo = data.schoolInfo || {
                educationDepartment: '',
                schoolName: ''
            };
            appData.currentTeacher = null;
            appData.currentClass = null;
            appData.currentSection = null;
            appData.currentDay = null;
            appData.currentPeriod = null;
            appData.currentSubject = null;
            appData.selectedTeacher = null;
            appData.weekOffset = 0;
            console.log('تم تحميل البيانات من Firestore');
        } else {
            // إذا لم توجد بيانات، يتم إنشاء بيانات افتراضية
            await saveData();
            console.log('تم إنشاء بيانات افتراضية في Firestore');
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        showInternalAlert('حدث خطأ أثناء تحميل البيانات');
    }
}

// وظيفة التنقل بين الصفحات
async function navigateTo(pageId) {
    document.querySelectorAll('.container').forEach(page => page.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    switch(pageId) {
        case 'home-page':
            await renderSchoolInfo();
            break;
        case 'add-classes-page': 
            await renderClassesList(); 
            break;
        case 'add-subjects-page': 
            await renderClassesListForSubjects(); 
            break;
        case 'add-teachers-page': 
            await renderTeachersList(); 
            break;
        case 'teacher-login-page':
            loadTeacherCredentials();
            break;
        case 'teacher-schedule-page':
            appData.weekOffset = 0;
            await renderTeacherSchedule();
            break;
        case 'student-page': 
            await renderStudentClassesList(); 
            break;
        case 'assign-subjects-page':
            await renderClassesListForAssignment();
            if(appData.selectedTeacher) document.getElementById('assign-teacher-name').textContent = appData.selectedTeacher.name;
            break;
        case 'setup-schedules-page': 
            await renderClassesListForSchedules(); 
            break;
        case 'schedule-sections-page': 
            await renderSectionsListForSchedules(); 
            break;
        case 'class-schedule-page': 
            await renderClassSchedule(); 
            break;
        case 'student-schedule-page':
            appData.weekOffset = 0;
            await renderStudentSchedule();
            break;
        case 'admin-login-page':
            loadAdminCredentials();
            break;
        case 'add-homework-page':
            const homeworkText = document.getElementById('homework-text').value;
            document.getElementById('delete-homework-btn').classList.toggle('hidden', !homeworkText);
            document.getElementById('lesson-title').value = '';
            break;
        case 'change-admin-credentials-page':
            document.getElementById('new-admin-username').value = appData.adminCredentials.username;
            document.getElementById('new-admin-password').value = '';
            document.getElementById('confirm-admin-password').value = '';
            break;
        case 'change-teacher-credentials-page':
            if (appData.selectedTeacher) {
                document.getElementById('new-teacher-username').value = appData.selectedTeacher.name;
                document.getElementById('new-teacher-password').value = '';
                document.getElementById('confirm-teacher-password').value = '';
            }
            break;
        case 'school-info-page':
            await renderSchoolInfoInputs();
            break;
        case 'reports-page':
            await renderReportFilters();
            break;
    }
}

// وظيفة تسجيل دخول الإدارة
function adminLogin() {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    const rememberMe = document.getElementById('admin-remember-me').checked;

    if (username === appData.adminCredentials.username && password === appData.adminCredentials.password) {
        if (rememberMe) {
            localStorage.setItem('adminCredentials', JSON.stringify({ username, password }));
        } else {
            localStorage.removeItem('adminCredentials');
        }
        if (appData.adminCredentials.isTemporary) {
            navigateTo('change-admin-credentials-page');
        } else {
            navigateTo('admin-page');
        }
    } else {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
}

// وظيفة تحميل بيانات تسجيل دخول الإدارة
function loadAdminCredentials() {
    const savedCredentials = localStorage.getItem('adminCredentials');
    if (savedCredentials) {
        const { username, password } = JSON.parse(savedCredentials);
        document.getElementById('admin-username').value = username;
        document.getElementById('admin-password').value = password;
        document.getElementById('admin-remember-me').checked = true;
    } else {
        document.getElementById('admin-username').value = '';
        document.getElementById('admin-password').value = '';
        document.getElementById('admin-remember-me').checked = false;
    }
}

// وظيفة تغيير بيانات الإدارة
async function changeAdminCredentials() {
    const newUsername = document.getElementById('new-admin-username').value.trim();
    const newPassword = document.getElementById('new-admin-password').value.trim();
    const confirmPassword = document.getElementById('confirm-admin-password').value.trim();

    if (!newUsername || !newPassword) {
        alert('الرجاء إدخال اسم المستخدم وكلمة المرور');
        return;
    }
    if (newPassword !== confirmPassword) {
        alert('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
        return;
    }
    appData.adminCredentials.username = newUsername;
    appData.adminCredentials.password = newPassword;
    appData.adminCredentials.isTemporary = false;
    await saveData();
    showInternalAlert('تم تغيير بيانات الحساب بنجاح');
    navigateTo('admin-page');
}

// وظيفة تحميل بيانات تسجيل دخول المعلم
function loadTeacherCredentials() {
    const savedCredentials = localStorage.getItem('teacherCredentials');
    if (savedCredentials) {
        const { username, password } = JSON.parse(savedCredentials);
        document.getElementById('teacher-username').value = username;
        document.getElementById('teacher-password').value = password;
        document.getElementById('teacher-remember-me').checked = true;
    } else {
        document.getElementById('teacher-username').value = '';
        document.getElementById('teacher-password').value = '';
        document.getElementById('teacher-remember-me').checked = false;
    }
}

// وظيفة تغيير بيانات المعلم
async function changeTeacherCredentials() {
    const newUsername = document.getElementById('new-teacher-username').value.trim();
    const newPassword = document.getElementById('new-teacher-password').value.trim();
    const confirmPassword = document.getElementById('confirm-teacher-password').value.trim();

    if (!newUsername || !newPassword) {
        alert('الرجاء إدخال اسم المستخدم وكلمة المرور');
        return;
    }
    if (newPassword !== confirmPassword) {
        alert('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
        return;
    }
    if (appData.selectedTeacher) {
        appData.selectedTeacher.name = newUsername;
        appData.selectedTeacher.password = newPassword;
        await saveData();
        showInternalAlert('تم تغيير بيانات الحساب بنجاح');
        document.getElementById('teacher-name-display').textContent = newUsername;
        await renderTeachersList();
        navigateTo('teacher-details-page');
    }
}

// وظيفة تسجيل دخول المعلم
function teacherLogin() {
    const username = document.getElementById('teacher-username').value.trim();
    const password = document.getElementById('teacher-password').value.trim();
    const rememberMe = document.getElementById('teacher-remember-me').checked;
    const teacher = appData.teachers.find(t => t.name === username && t.password === password);
    if (teacher) {
        appData.currentTeacher = teacher;
        if (rememberMe) {
            localStorage.setItem('teacherCredentials', JSON.stringify({ username, password }));
        } else {
            localStorage.removeItem('teacherCredentials');
        }
        document.getElementById('logged-teacher-name').textContent = teacher.name;
        navigateTo('teacher-schedule-page');
    } else {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
}

// وظيفة عرض بيانات المدرسة في الصفحة الرئيسية
async function renderSchoolInfo() {
    document.getElementById('education-department').textContent = appData.schoolInfo.educationDepartment || 'غير محدد';
    document.getElementById('school-name').textContent = appData.schoolInfo.schoolName || 'غير محدد';
}

// وظيفة عرض حقول إدخال بيانات المدرسة
async function renderSchoolInfoInputs() {
    document.getElementById('education-department-input').value = appData.schoolInfo.educationDepartment || '';
    document.getElementById('school-name-input').value = appData.schoolInfo.schoolName || '';
}

// وظيفة حفظ بيانات المدرسة
async function saveSchoolInfo() {
    const educationDepartment = document.getElementById('education-department-input').value.trim();
    const schoolName = document.getElementById('school-name-input').value.trim();

    if (!educationDepartment || !schoolName) {
        alert('الرجاء إدخال إدارة التعليم واسم المدرسة');
        return;
    }

    appData.schoolInfo.educationDepartment = educationDepartment;
    appData.schoolInfo.schoolName = schoolName;
    await saveData();
    showInternalAlert('تم حفظ بيانات المدرسة بنجاح');
    navigateTo('admin-page');
}

// وظائف إدارة الصفوف والفصول
async function addClass() {
    const className = document.getElementById('new-class-input').value.trim();
    if (className) {
        appData.classes.push({ id: Date.now(), name: className, sections: [] });
        document.getElementById('new-class-input').value = '';
        await saveData();
        await renderClassesList();
    } else {
        alert('الرجاء إدخال اسم الصف');
    }
}

async function editClass(classId, newName) {
    const classObj = appData.classes.find(c => c.id === classId);
    if (classObj && newName.trim()) {
        classObj.name = newName.trim();
        await saveData();
        await renderClassesList();
    }
}

async function deleteClass(classId) {
    if (confirm('هل أنت متأكد من حذف هذا الصف؟ سيتم حذف جميع الفصول والمواد والواجبات المرتبطة به.')) {
        appData.classes = appData.classes.filter(c => c.id !== classId);
        await saveData();
        await renderClassesList();
    }
}

async function renderClassesList() {
    const classesList = document.getElementById('classes-list');
    classesList.innerHTML = '';
    appData.classes.forEach(classObj => {
        const classElement = document.createElement('div');
        classElement.className = 'item-card';
        classElement.innerHTML = `
            <div class="item-name">${classObj.name}</div>
            <div class="item-actions">
                <button class="edit-btn" data-id="${classObj.id}" data-name="${classObj.name}">تعديل</button>
                <button class="delete-btn" data-id="${classObj.id}">حذف</button>
            </div>
        `;
        classElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('edit-btn') && !e.target.classList.contains('delete-btn')) {
                appData.currentClass = classObj;
                document.getElementById('selected-class-name').textContent = classObj.name;
                renderSectionsList();
                navigateTo('add-sections-page');
            }
        });
        classesList.appendChild(classElement);
    });
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const classId = parseInt(this.getAttribute('data-id'));
            const currentName = this.getAttribute('data-name');
            const newName = prompt('أدخل الاسم الجديد للصف:', currentName);
            if (newName && newName.trim() !== currentName) await editClass(classId, newName.trim());
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const classId = parseInt(this.getAttribute('data-id'));
            await deleteClass(classId);
        });
    });
}

async function addSection() {
    const sectionName = document.getElementById('new-section-input').value.trim();
    if (sectionName && appData.currentClass) {
        appData.currentClass.sections.push({ id: Date.now(), name: sectionName, schedule: createEmptySchedule(), subjects: [], homeworks: [] });
        document.getElementById('new-section-input').value = '';
        await saveData();
        await renderSectionsList();
    } else {
        alert('الرجاء إدخال اسم الفصل');
    }
}

async function editSection(sectionId, newName) {
    if (appData.currentClass && newName.trim()) {
        const section = appData.currentClass.sections.find(s => s.id === sectionId);
        if (section) {
            section.name = newName.trim();
            await saveData();
            await renderSectionsList();
        }
    }
}

async function deleteSection(sectionId) {
    if (appData.currentClass && confirm('هل أنت متأكد من حذف هذا الفصل؟ سيتم حذف جميع المواد والواجبات المرتبطة به.')) {
        appData.currentClass.sections = appData.currentClass.sections.filter(s => s.id !== sectionId);
        await saveData();
        await renderSectionsList();
    }
}

async function renderSectionsList() {
    const sectionsList = document.getElementById('sections-list');
    sectionsList.innerHTML = '';
    if (appData.currentClass) {
        appData.currentClass.sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'item-card';
            sectionElement.innerHTML = `
                <div class="item-name">${section.name}</div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${section.id}" data-name="${section.name}">تعديل</button>
                    <button class="delete-btn" data-id="${section.id}">حذف</button>
                </div>
            `;
            sectionsList.appendChild(sectionElement);
            sectionElement.querySelector('.edit-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                const sectionId = parseInt(e.target.getAttribute('data-id'));
                const currentName = e.target.getAttribute('data-name');
                const newName = prompt('أدخل الاسم الجديد للفصل:', currentName);
                if (newName && newName.trim() !== currentName) await editSection(sectionId, newName.trim());
            });
            sectionElement.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                const sectionId = parseInt(e.target.getAttribute('data-id'));
                await deleteSection(sectionId);
            });
        });
    }
}

// وظائف إدارة المواد
async function renderClassesListForSubjects() {
    const classSelect = document.getElementById('class-select');
    classSelect.innerHTML = '<option value="">-- اختر الصف --</option>';
    appData.classes.forEach(classObj => {
        const option = document.createElement('option');
        option.value = classObj.id;
        option.textContent = classObj.name;
        classSelect.appendChild(option);
    });

    classSelect.onchange = async () => {
        const classId = parseInt(classSelect.value);
        const selectedClass = appData.classes.find(c => c.id === classId);
        appData.currentClass = selectedClass;
        await renderSubjectsList();
    };

    const selectedClassId = parseInt(classSelect.value);
    if (selectedClassId) {
        appData.currentClass = appData.classes.find(c => c.id === selectedClassId);
        await renderSubjectsList();
    } else {
        document.getElementById('class-subjects-list').innerHTML = '';
    }
}

async function addSubject() {
    const subjectName = document.getElementById('new-subject-input').value.trim();
    const classId = parseInt(document.getElementById('class-select').value);
    if (!subjectName || !classId) {
        alert('الرجاء اختيار الصف وإدخال اسم المادة');
        return;
    }
    const selectedClass = appData.classes.find(c => c.id === classId);
    if (selectedClass) {
        selectedClass.sections.forEach(section => {
            section.subjects.push({ id: Date.now(), name: subjectName, assignedTeacher: null });
        });
        document.getElementById('new-subject-input').value = '';
        await saveData();
        appData.currentClass = selectedClass;
        await renderSubjectsList();
    }
}

async function editSubject(subjectId, newName) {
    if (appData.currentClass && newName.trim()) {
        appData.currentClass.sections.forEach(section => {
            const subject = section.subjects.find(s => s.id === subjectId);
            if (subject) subject.name = newName.trim();
        });
        await saveData();
        await renderSubjectsList();
    }
}

async function deleteSubject(subjectId) {
    if (appData.currentClass && confirm('هل أنت متأكد من حذف هذه المادة؟ سيتم حذفها من جميع الفصول.')) {
        appData.currentClass.sections.forEach(section => {
            section.subjects = section.subjects.filter(s => s.id !== subjectId);
        });
        await saveData();
        await renderSubjectsList();
    }
}

async function renderSubjectsList() {
    const subjectsList = document.getElementById('class-subjects-list');
    subjectsList.innerHTML = '';
    if (appData.currentClass && appData.currentClass.sections.length > 0) {
        const subjects = appData.currentClass.sections[0].subjects; // المواد متشابهة عبر الفصول
        subjects.forEach(subject => {
            const subjectElement = document.createElement('div');
            subjectElement.className = 'item-card';
            subjectElement.innerHTML = `
                <div class="item-name">${subject.name}</div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${subject.id}" data-name="${subject.name}">تعديل</button>
                    <button class="delete-btn" data-id="${subject.id}">حذف</button>
                </div>
            `;
            subjectsList.appendChild(subjectElement);
            subjectElement.querySelector('.edit-btn').addEventListener('click', async (e) => {
                const subjectId = parseInt(e.target.getAttribute('data-id'));
                const currentName = e.target.getAttribute('data-name');
                const newName = prompt('أدخل الاسم الجديد للمادة:', currentName);
                if (newName && newName.trim() !== currentName) await editSubject(subjectId, newName.trim());
            });
            subjectElement.querySelector('.delete-btn').addEventListener('click', async (e) => {
                const subjectId = parseInt(e.target.getAttribute('data-id'));
                await deleteSubject(subjectId);
            });
        });
    }
}

// وظائف إدارة الجداول الدراسية
function createEmptySchedule() {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    const schedule = {};
    days.forEach(day => {
        schedule[day] = Array(7).fill(null).map(() => ({ subject: null }));
    });
    return schedule;
}

async function renderClassesListForSchedules() {
    const classesList = document.getElementById('classes-list-for-schedules');
    classesList.innerHTML = '';
    appData.classes.forEach(classObj => {
        const classElement = document.createElement('div');
        classElement.className = 'item-card';
        classElement.innerHTML = `<div class="item-name">${classObj.name}</div>`;
        classElement.addEventListener('click', () => {
            appData.currentClass = classObj;
            navigateTo('schedule-sections-page');
        });
        classesList.appendChild(classElement);
    });
}

async function renderSectionsListForSchedules() {
    const sectionsList = document.getElementById('sections-list-for-schedules');
    sectionsList.innerHTML = '';
    if (appData.currentClass) {
        appData.currentClass.sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'item-card';
            sectionElement.innerHTML = `<div class="item-name">${section.name}</div>`;
            sectionElement.addEventListener('click', () => {
                appData.currentSection = section;
                navigateTo('class-schedule-page');
            });
            sectionsList.appendChild(sectionElement);
        });
    }
}

async function renderClassSchedule() {
    if (!appData.currentClass || !appData.currentSection) return;
    const table = document.getElementById('class-schedule-table');
    const tbody = document.getElementById('schedule-tbody');
    table.innerHTML = '<thead><tr></tr></thead><tbody id="schedule-tbody"></tbody>';
    const thead = table.querySelector('thead tr');
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

    thead.innerHTML = '<th>اليوم</th>';
    for (let i = 1; i <= 7; i++) {
        thead.innerHTML += `<th>الحصة ${i}</th>`;
    }

    days.forEach(day => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${day}</td>`;
        for (let period = 0; period < 7; period++) {
            const cell = document.createElement('td');
            cell.className = 'schedule-cell';
            const subject = appData.currentSection.schedule[day][period].subject;
            cell.textContent = subject || 'فارغ';
            cell.addEventListener('click', () => showSubjectSelectionModal(day, period));
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    });
}

function showSubjectSelectionModal(day, period) {
    const modal = document.getElementById('subject-selection-modal');
    const subjectsList = document.getElementById('subjects-dropdown-list');
    subjectsList.innerHTML = '';
    if (appData.currentSection) {
        appData.currentSection.subjects.forEach(subject => {
            const subjectOption = document.createElement('div');
            subjectOption.className = 'subject-option';
            subjectOption.textContent = subject.name;
            subjectOption.addEventListener('click', async () => {
                appData.currentSection.schedule[day][period].subject = subject.name;
                await saveData();
                modal.classList.add('hidden');
                renderClassSchedule();
            });
            subjectsList.appendChild(subjectOption);
        });
        const emptyOption = document.createElement('div');
        emptyOption.className = 'subject-option';
        emptyOption.textContent = 'فارغ';
        emptyOption.addEventListener('click', async () => {
            appData.currentSection.schedule[day][period].subject = null;
            await saveData();
            modal.classList.add('hidden');
            renderClassSchedule();
        });
        subjectsList.appendChild(emptyOption);
    }
    modal.classList.remove('hidden');
}

async function saveSchedule() {
    await saveData();
    showInternalAlert('تم حفظ الجدول بنجاح');
}

// وظائف إدارة المعلمين
async function addTeacher() {
    const teacherName = document.getElementById('new-teacher-input').value.trim();
    if (teacherName) {
        const newTeacher = {
            id: Date.now(),
            name: teacherName,
            password: Math.random().toString(36).slice(-8),
            assignedSubjects: []
        };
        appData.teachers.push(newTeacher);
        document.getElementById('new-teacher-input').value = '';
        await saveData();
        await renderTeachersList();
    } else {
        alert('الرجاء إدخال اسم المعلم');
    }
}

async function renderTeachersList() {
    const teachersList = document.getElementById('teachers-list');
    teachersList.innerHTML = '';
    appData.teachers.forEach(teacher => {
        const teacherElement = document.createElement('div');
        teacherElement.className = 'item-card';
        teacherElement.innerHTML = `
            <div class="item-name">${teacher.name}</div>
            <div class="item-actions">
                <button class="edit-btn" data-id="${teacher.id}">تفاصيل</button>
                <button class="delete-btn" data-id="${teacher.id}">حذف</button>
            </div>
        `;
        teacherElement.querySelector('.edit-btn').addEventListener('click', () => {
            appData.selectedTeacher = teacher;
            document.getElementById('teacher-name-display').textContent = teacher.name;
            document.getElementById('password-display').classList.add('hidden');
            navigateTo('teacher-details-page');
        });
        teacherElement.querySelector('.delete-btn').addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف هذا المعلم؟ سيتم إلغاء إسناد جميع المواد المرتبطة به.')) {
                appData.teachers = appData.teachers.filter(t => t.id !== teacher.id);
                appData.classes.forEach(cls => {
                    cls.sections.forEach(section => {
                        section.subjects.forEach(subject => {
                            if (subject.assignedTeacher === teacher.id) {
                                subject.assignedTeacher = null;
                            }
                        });
                    });
                });
                await saveData();
                await renderTeachersList();
            }
        });
        teachersList.appendChild(teacherElement);
    });
}

async function generateTeacherPassword() {
    if (appData.selectedTeacher) {
        const newPassword = Math.random().toString(36).slice(-8);
        appData.selectedTeacher.password = newPassword;
        await saveData();
        const passwordDisplay = document.getElementById('password-display');
        document.getElementById('generated-password').textContent = newPassword;
        passwordDisplay.classList.remove('hidden');
    }
}

async function renderClassesListForAssignment() {
    const classesList = document.getElementById('classes-list-for-assignment');
    classesList.innerHTML = '';
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    appData.classes.forEach(classObj => {
        const classElement = document.createElement('div');
        classElement.className = 'item-card';
        classElement.innerHTML = `<div class="item-name">${classObj.name}</div>`;
        classElement.addEventListener('click', () => {
            appData.currentClass = classObj;
            renderSectionsListForAssignment();
            document.getElementById('step1').classList.add('hidden');
            document.getElementById('step2').classList.remove('hidden');
        });
        classesList.appendChild(classElement);
    });
}

async function renderSectionsListForAssignment() {
    const sectionsList = document.getElementById('sections-list-for-assignment');
    sectionsList.innerHTML = '';
    if (appData.currentClass) {
        appData.currentClass.sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'item-card';
            sectionElement.innerHTML = `<div class="item-name">${section.name}</div>`;
            sectionElement.addEventListener('click', () => {
                appData.currentSection = section;
                renderSubjectsListForAssignment();
                document.getElementById('step2').classList.add('hidden');
                document.getElementById('step3').classList.remove('hidden');
            });
            sectionsList.appendChild(sectionElement);
        });
    }
}

async function renderSubjectsListForAssignment() {
    const subjectsList = document.getElementById('subjects-list-for-assignment');
    subjectsList.innerHTML = '';
    if (appData.currentSection && appData.selectedTeacher) {
        appData.currentSection.subjects.forEach(subject => {
            const isAssignedToCurrent = subject.assignedTeacher === appData.selectedTeacher.id;
            const isAssignedToOther = subject.assignedTeacher && subject.assignedTeacher !== appData.selectedTeacher.id;
            const subjectElement = document.createElement('div');
            subjectElement.className = `item-card ${isAssignedToCurrent ? 'assigned-to-current' : ''} ${isAssignedToOther ? 'assigned-to-other' : ''}`;
            subjectElement.innerHTML = `
                <div class="item-name">${subject.name}</div>
                <div class="item-details">${isAssignedToCurrent ? 'مسندة لهذا المعلم' : isAssignedToOther ? 'مسندة لمعلم آخر' : 'غير مسندة'}</div>
            `;
            if (!isAssignedToOther) {
                subjectElement.addEventListener('click', async () => {
                    if (isAssignedToCurrent) {
                        subject.assignedTeacher = null;
                        showInternalAlert('تم إلغاء إسناد المادة');
                    } else {
                        subject.assignedTeacher = appData.selectedTeacher.id;
                        appData.selectedTeacher.assignedSubjects.push({
                            classId: appData.currentClass.id,
                            sectionId: appData.currentSection.id,
                            subjectId: subject.id
                        });
                        showInternalAlert('تم إسناد المادة بنجاح');
                    }
                    await saveData();
                    renderSubjectsListForAssignment();
                });
            }
            subjectsList.appendChild(subjectElement);
        });
    }
}

// وظائف جدول المعلم
async function renderTeacherSchedule() {
    if (!appData.currentTeacher) return;
    const table = document.getElementById('teacher-schedule-table');
    const tbody = document.getElementById('teacher-schedule-tbody');
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    tbody.innerHTML = '';

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
        const day = days[dayIndex];
        const row = document.createElement('tr');
        const hijriDate = await getHijriDateForDay(dayIndex);
        const isToday = new Date().getDay() === dayIndex && appData.weekOffset === 0;
        row.innerHTML = `<td class="${isToday ? 'current-day' : ''}">${day} (${hijriDate.formatted})</td>`;
        for (let period = 0; period < 7; period++) {
            const cell = document.createElement('td');
            cell.className = 'schedule-cell';
            let found = false;
            appData.classes.forEach(cls => {
                cls.sections.forEach(section => {
                    const subject = section.schedule[day][period].subject;
                    const subjectObj = section.subjects.find(s => s.name === subject && s.assignedTeacher === appData.currentTeacher.id);
                    if (subjectObj) {
                        const hasHomework = section.homeworks.some(h => h.day === day && h.period === period && h.subject === subject);
                        cell.innerHTML = `
                            ${cls.name} - ${section.name}<br>${subject}
                            <br><span class="${hasHomework ? 'has-homework' : 'no-homework'}">${hasHomework ? 'يوجد واجب' : 'لا يوجد واجب'}</span>
                        `;
                        cell.addEventListener('click', () => {
                            appData.currentClass = cls;
                            appData.currentSection = section;
                            appData.currentDay = day;
                            appData.currentPeriod = period;
                            appData.currentSubject = subject;
                            renderHomeworkForm();
                            navigateTo('add-homework-page');
                        });
                        found = true;
                    }
                });
            });
            if (!found) cell.textContent = 'فارغ';
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    }

    const navigation = document.createElement('div');
    navigation.id = 'teacher-schedule-navigation';
    navigation.innerHTML = `
        <button class="week-nav-btn prev-week-btn"></button>
        <button class="week-nav-btn next-week-btn"></button>
    `;
    table.parentElement.insertBefore(navigation, table);
    navigation.querySelector('.prev-week-btn').addEventListener('click', async () => {
        appData.weekOffset--;
        await renderTeacherSchedule();
    });
    navigation.querySelector('.next-week-btn').addEventListener('click', async () => {
        appData.weekOffset++;
        await renderTeacherSchedule();
    });
}

// وظائف إدارة الواجبات
async function renderHomeworkForm() {
    if (!appData.currentClass || !appData.currentSection || !appData.currentDay || appData.currentPeriod === null || !appData.currentSubject) return;
    document.getElementById('homework-day').textContent = appData.currentDay;
    document.getElementById('homework-period').textContent = `الحصة ${appData.currentPeriod + 1}`;
    document.getElementById('homework-subject').textContent = appData.currentSubject;
    document.getElementById('homework-class').textContent = appData.currentClass.name;
    document.getElementById('homework-section').textContent = appData.currentSection.name;

    const existingHomework = appData.currentSection.homeworks.find(h => h.day === appData.currentDay && h.period === appData.currentPeriod && h.subject === appData.currentSubject);
    document.getElementById('homework-text').value = existingHomework ? existingHomework.text : '';
    document.getElementById('lesson-title').value = existingHomework ? existingHomework.lessonTitle : '';
    document.getElementById('delete-homework-btn').classList.toggle('hidden', !existingHomework);
}

async function saveHomework() {
    const homeworkText = document.getElementById('homework-text').value.trim();
    const lessonTitle = document.getElementById('lesson-title').value.trim();
    if (!homeworkText || !lessonTitle) {
        alert('الرجاء إدخال عنوان الدرس ونص الواجب');
        return;
    }
    if (appData.currentSection && appData.currentDay && appData.currentPeriod !== null && appData.currentSubject) {
        const hijriDate = await getHijriDateForDay(['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].indexOf(appData.currentDay));
        const homework = {
            id: Date.now(),
            day: appData.currentDay,
            period: appData.currentPeriod,
            subject: appData.currentSubject,
            text: homeworkText,
            lessonTitle: lessonTitle,
            hijriDate: hijriDate.formatted,
            classId: appData.currentClass.id,
            sectionId: appData.currentSection.id
        };
        const existingIndex = appData.currentSection.homeworks.findIndex(h => h.day === appData.currentDay && h.period === appData.currentPeriod && h.subject === appData.currentSubject);
        if (existingIndex >= 0) {
            appData.currentSection.homeworks[existingIndex] = homework;
        } else {
            appData.currentSection.homeworks.push(homework);
        }
        await saveData();
        showInternalAlert('تم حفظ الواجب بنجاح');
        navigateTo('teacher-schedule-page');
    }
}

async function deleteHomework() {
    if (appData.currentSection && appData.currentDay && appData.currentPeriod !== null && appData.currentSubject && confirm('هل أنت متأكد من حذف هذا الواجب؟')) {
        appData.currentSection.homeworks = appData.currentSection.homeworks.filter(h => !(h.day === appData.currentDay && h.period === appData.currentPeriod && h.subject === appData.currentSubject));
        await saveData();
        showInternalAlert('تم حذف الواجب بنجاح');
        navigateTo('teacher-schedule-page');
    }
}

// وظائف صفحة الطالب
async function renderStudentClassesList() {
    const classesList = document.getElementById('student-classes-list');
    classesList.innerHTML = '';
    appData.classes.forEach(classObj => {
        const classElement = document.createElement('div');
        classElement.className = 'item-card';
        classElement.innerHTML = `<div class="item-name">${classObj.name}</div>`;
        classElement.addEventListener('click', () => {
            appData.currentClass = classObj;
            document.getElementById('student-class-name').textContent = classObj.name;
            renderStudentSectionsList();
            navigateTo('student-sections-page');
        });
        classesList.appendChild(classElement);
    });
}

async function renderStudentSectionsList() {
    const sectionsList = document.getElementById('student-sections-list');
    sectionsList.innerHTML = '';
    if (appData.currentClass) {
        appData.currentClass.sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'item-card';
            sectionElement.innerHTML = `<div class="item-name">${section.name}</div>`;
            sectionElement.addEventListener('click', () => {
                appData.currentSection = section;
                document.getElementById('student-schedule-class').textContent = appData.currentClass.name;
                document.getElementById('student-schedule-section').textContent = section.name;
                navigateTo('student-schedule-page');
            });
            sectionsList.appendChild(sectionElement);
        });
    }
}

async function renderStudentSchedule() {
    if (!appData.currentClass || !appData.currentSection) return;
    const table = document.getElementById('student-schedule-table');
    const tbody = document.getElementById('student-schedule-tbody');
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    tbody.innerHTML = '';

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
        const day = days[dayIndex];
        const row = document.createElement('tr');
        const hijriDate = await getHijriDateForDay(dayIndex);
        const isToday = new Date().getDay() === dayIndex && appData.weekOffset === 0;
        row.innerHTML = `<td class="${isToday ? 'current-day' : ''}">${day} (${hijriDate.formatted})</td>`;
        for (let period = 0; period < 7; period++) {
            const cell = document.createElement('td');
            cell.className = 'schedule-cell';
            const subject = appData.currentSection.schedule[day][period].subject;
            if (subject) {
                const homework = appData.currentSection.homeworks.find(h => h.day === day && h.period === period && h.subject === subject);
                cell.innerHTML = `
                    ${subject}
                    <br><span class="${homework ? 'has-homework' : 'no-homework'}">${homework ? 'يوجد واجب' : 'لا يوجد واجب'}</span>
                `;
                if (homework) {
                    cell.addEventListener('click', () => {
                        appData.currentDay = day;
                        appData.currentPeriod = period;
                        appData.currentSubject = subject;
                        renderHomeworkDetails(homework);
                        navigateTo('view-homework-page');
                    });
                }
            } else {
                cell.textContent = 'فارغ';
            }
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    }

    const navigation = document.createElement('div');
    navigation.id = 'student-schedule-navigation';
    navigation.innerHTML = `
        <button class="week-nav-btn prev-week-btn"></button>
        <button class="week-nav-btn next-week-btn"></button>
    `;
    table.parentElement.insertBefore(navigation, table);
    navigation.querySelector('.prev-week-btn').addEventListener('click', async () => {
        appData.weekOffset--;
        await renderStudentSchedule();
    });
    navigation.querySelector('.next-week-btn').addEventListener('click', async () => {
        appData.weekOffset++;
        await renderStudentSchedule();
    });
}

function renderHomeworkDetails(homework) {
    document.getElementById('view-homework-day').textContent = homework.day;
    document.getElementById('view-homework-period').textContent = `الحصة ${homework.period + 1}`;
    document.getElementById('view-homework-subject').textContent = homework.subject;
    document.getElementById('view-homework-lesson-title').textContent = homework.lessonTitle;
    document.getElementById('homework-content-text').textContent = homework.text;
}

// وظائف التقارير
async function renderReportFilters() {
    const classSelect = document.getElementById('report-class-select');
    const sectionSelect = document.getElementById('report-section-select');
    const teacherSelect = document.getElementById('report-teacher-select');

    classSelect.innerHTML = '<option value="">-- اختر الصف --</option>';
    appData.classes.forEach(classObj => {
        const option = document.createElement('option');
        option.value = classObj.id;
        option.textContent = classObj.name;
        classSelect.appendChild(option);
    });

    classSelect.onchange = async () => {
        const classId = parseInt(classSelect.value);
        sectionSelect.innerHTML = '<option value="">-- اختر الفصل --</option>';
        if (classId) {
            const selectedClass = appData.classes.find(c => c.id === classId);
            selectedClass.sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section.id;
                option.textContent = section.name;
                sectionSelect.appendChild(option);
            });
        }
    };

    teacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
    appData.teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = teacher.name;
        teacherSelect.appendChild(option);
    });

    flatpickr('#report-date', {
        locale: 'ar',
        dateFormat: 'Y-m-d',
        defaultDate: new Date()
    });

    flatpickr('#teacher-report-date', {
        locale: 'ar',
        dateFormat: 'Y-m-d',
        defaultDate: new Date()
    });
}

async function generateSectionReport() {
    const classId = parseInt(document.getElementById('report-class-select').value);
    const sectionId = parseInt(document.getElementById('report-section-select').value);
    const period = document.getElementById('report-period').value;
    const date = document.getElementById('report-date').value;

    if (!classId || !sectionId || !date) {
        alert('الرجاء اختيار الصف، الفصل، والتاريخ');
        return;
    }

    const selectedClass = appData.classes.find(c => c.id === classId);
    const selectedSection = selectedClass.sections.find(s => s.id === sectionId);
    const reportResults = document.getElementById('section-report-results');
    reportResults.innerHTML = '';

    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    let endDate = new Date(startDate);

    if (period === 'weekly') {
        endDate.setDate(startDate.getDate() + 6);
    } else if (period === 'monthly') {
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setDate(0);
    }

    const homeworks = selectedSection.homeworks.filter(h => {
        const [hDay, hMonth, hYear] = h.hijriDate.split(' ').map((val, idx) => idx === 1 ? val : parseInt(val));
        const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
        const hMonthIndex = hijriMonths.indexOf(hMonth);
        const homeworkDate = new Date(hYear, hMonthIndex, hDay);
        return homeworkDate >= startDate && homeworkDate <= endDate;
    });

    if (homeworks.length === 0) {
        reportResults.innerHTML = '<p>لا توجد واجبات لهذه الفترة</p>';
        return;
    }

    homeworks.forEach(homework => {
        const reportItem = document.createElement('div');
        reportItem.className = 'report-item';
        reportItem.innerHTML = `
            <h4>${homework.subject} - ${homework.lessonTitle}</h4>
            <p>اليوم: ${homework.day} (${homework.hijriDate})</p>
            <p>الحصة: ${homework.period + 1}</p>
            <p>الواجب: ${homework.text}</p>
        `;
        reportResults.appendChild(reportItem);
    });
}

async function generateTeacherReport() {
    const teacherId = parseInt(document.getElementById('report-teacher-select').value);
    const period = document.getElementById('teacher-report-period').value;
    const date = document.getElementById('teacher-report-date').value;

    if (!teacherId || !date) {
        alert('الرجاء اختيار المعلم والتاريخ');
        return;
    }

    const selectedTeacher = appData.teachers.find(t => t.id === teacherId);
    const reportResults = document.getElementById('teacher-report-results');
    reportResults.innerHTML = '';

    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    let endDate = new Date(startDate);

    if (period === 'weekly') {
        endDate.setDate(startDate.getDate() + 6);
    } else if (period === 'monthly') {
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setDate(0);
    }

    const homeworks = [];
    appData.classes.forEach(cls => {
        cls.sections.forEach(section => {
            section.homeworks.forEach(homework => {
                const subject = section.subjects.find(s => s.name === homework.subject);
                if (subject && subject.assignedTeacher === teacherId) {
                    const [hDay, hMonth, hYear] = homework.hijriDate.split(' ').map((val, idx) => idx === 1 ? val : parseInt(val));
                    const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
                    const hMonthIndex = hijriMonths.indexOf(hMonth);
                    const homeworkDate = new Date(hYear, hMonthIndex, hDay);
                    if (homeworkDate >= startDate && homeworkDate <= endDate) {
                        homeworks.push({ ...homework, className: cls.name, sectionName: section.name });
                    }
                }
            });
        });
    });

    if (homeworks.length === 0) {
        reportResults.innerHTML = '<p>لا توجد واجبات لهذه الفترة</p>';
        return;
    }

    homeworks.forEach(homework => {
        const reportItem = document.createElement('div');
        reportItem.className = 'report-item';
        reportItem.innerHTML = `
            <h4>${homework.subject} - ${homework.lessonTitle}</h4>
            <p>الصف: ${homework.className}</p>
            <p>الفصل: ${homework.sectionName}</p>
            <p>اليوم: ${homework.day} (${homework.hijriDate})</p>
            <p>الحصة: ${homework.period + 1}</p>
            <p>الواجب: ${homework.text}</p>
        `;
        reportResults.appendChild(reportItem);
    });
}

// إعداد الأحداث
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();

    document.getElementById('admin-login-btn').addEventListener('click', adminLogin);
    document.getElementById('back-from-admin-login').addEventListener('click', () => navigateTo('home-page'));
    document.getElementById('school-info-btn').addEventListener('click', () => navigateTo('school-info-page'));
    document.getElementById('add-classes-btn').addEventListener('click', () => navigateTo('add-classes-page'));
    document.getElementById('add-subjects-btn').addEventListener('click', () => navigateTo('add-subjects-page'));
    document.getElementById('setup-schedules-btn').addEventListener('click', () => navigateTo('setup-schedules-page'));
    document.getElementById('add-teachers-btn').addEventListener('click', () => navigateTo('add-teachers-page'));
    document.getElementById('reports-btn').addEventListener('click', () => navigateTo('reports-page'));
    document.getElementById('back-from-admin').addEventListener('click', () => navigateTo('home-page'));
    document.getElementById('add-class-btn').addEventListener('click', addClass);
    document.getElementById('back-from-classes').addEventListener('click', () => navigateTo('admin-page'));
    document.getElementById('add-section-btn').addEventListener('click', addSection);
    document.getElementById('back-from-sections').addEventListener('click', () => navigateTo('add-classes-page'));
    document.getElementById('add-subject-btn').addEventListener('click', addSubject);
    document.getElementById('back-from-subjects').addEventListener('click', () => navigateTo('admin-page'));
    document.getElementById('back-from-schedules').addEventListener('click', () => navigateTo('admin-page'));
    document.getElementById('back-from-schedule-sections').addEventListener('click', () => navigateTo('setup-schedules-page'));
    document.getElementById('save-schedule-btn').addEventListener('click', saveSchedule);
    document.getElementById('back-from-schedule').addEventListener('click', () => navigateTo('schedule-sections-page'));
    document.getElementById('cancel-subject-selection').addEventListener('click', () => document.getElementById('subject-selection-modal').classList.add('hidden'));
    document.getElementById('add-teacher-btn').addEventListener('click', addTeacher);
    document.getElementById('back-from-teachers').addEventListener('click', () => navigateTo('admin-page'));
    document.getElementById('assign-subjects-btn').addEventListener('click', () => navigateTo('assign-subjects-page'));
    document.getElementById('generate-password-btn').addEventListener('click', generateTeacherPassword);
    document.getElementById('back-from-teacher-details').addEventListener('click', () => navigateTo('add-teachers-page'));
    document.getElementById('back-to-step1').addEventListener('click', () => renderClassesListForAssignment());
    document.getElementById('back-to-step2').addEventListener('click', () => renderSectionsListForAssignment());
    document.getElementById('back-from-assign').addEventListener('click', () => navigateTo('teacher-details-page'));
    document.getElementById('teacher-login-btn').addEventListener('click', teacherLogin);
    document.getElementById('back-from-teacher-login').addEventListener('click', () => navigateTo('home-page'));
    document.getElementById('back-from-teacher-schedule').addEventListener('click', () => navigateTo('home-page'));
    document.getElementById('save-homework-btn').addEventListener('click', saveHomework);
    document.getElementById('delete-homework-btn').addEventListener('click', deleteHomework);
    document.getElementById('back-from-homework').addEventListener('click', () => navigateTo('teacher-schedule-page'));
    document.getElementById('back-from-student').addEventListener('click', () => navigateTo('home-page'));
    document.getElementById('back-from-student-sections').addEventListener('click', () => navigateTo('student-page'));
    document.getElementById('back-from-student-schedule').addEventListener('click', () => navigateTo('student-sections-page'));
    document.getElementById('back-from-view-homework').addEventListener('click', () => navigateTo('student-schedule-page'));
    document.getElementById('section-report-tab').addEventListener('click', () => {
        document.getElementById('section-report').classList.remove('hidden');
        document.getElementById('teacher-report').classList.add('hidden');
        document.getElementById('section-report-tab').classList.add('active');
        document.getElementById('teacher-report-tab').classList.remove('active');
    });
    document.getElementById('teacher-report-tab').addEventListener('click', () => {
        document.getElementById('teacher-report').classList.remove('hidden');
        document.getElementById('section-report').classList.add('hidden');
        document.getElementById('teacher-report-tab').classList.add('active');
        document.getElementById('section-report-tab').classList.remove('active');
    });
    document.getElementById('generate-section-report-btn').addEventListener('click', generateSectionReport);
    document.getElementById('generate-teacher-report-btn').addEventListener('click', generateTeacherReport);
    document.getElementById('back-from-reports').addEventListener('click', () => navigateTo('admin-page'));
    document.getElementById('save-school-info-btn').addEventListener('click', saveSchoolInfo);
    document.getElementById('back-from-school-info').addEventListener('click', () => navigateTo('admin-page'));
    document.getElementById('change-admin-credentials-btn').addEventListener('click', () => navigateTo('change-admin-credentials-page'));
    document.getElementById('save-admin-credentials-btn').addEventListener('click', changeAdminCredentials);
    document.getElementById('back-from-change-admin-credentials').addEventListener('click', () => navigateTo('admin-page'));
    document.getElementById('change-teacher-credentials-btn').addEventListener('click', () => navigateTo('change-teacher-credentials-page'));
    document.getElementById('save-teacher-credentials-btn').addEventListener('click', changeTeacherCredentials);
    document.getElementById('back-from-change-teacher-credentials').addEventListener('click', () => navigateTo('teacher-details-page'));
});