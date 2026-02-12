// ==================== ATTENDANCE.JS - Attendance System ====================
window.LMS = window.LMS || {};

LMS.Attendance = () => {
  const { students, settings, setPendingWork, showToast } = useContext(LMS.AppContext);
  const [attendance, setAttendance] = useState(() => LMS.DB.localLoad('attendance') || {});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attRoll, setAttRoll] = useState('');
  const [attStatus, setAttStatus] = useState(true);
  const { Button, Card, Input, Icons } = LMS;

  // Auto-save attendance
  useEffect(() => {
    LMS.DB.localSave('attendance', attendance);
    if (LMS.DB.isConfigured && LMS.DB.userId) LMS.DB.save('attendance', attendance);
  }, [attendance]);

  // Filter active students
  const activeStudents = useMemo(() => students.filter(s => s.isActive !== false), [students]);

  const getLastNDays = (n) => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const recentDates = getLastNDays(30);

  const markAttendance = (e) => {
    e.preventDefault();
    const student = students.find(s => s.rollNo?.toLowerCase() === attRoll.toLowerCase());
    if (!student) {
      // Warning flow for unknown student / record not updated
      if (confirm(`Student with Roll No "${attRoll}" not found in system.\n\nAdd this to Pending Work list to check later?`)) {
        const newWork = {
          id: LMS.generateId(),
          text: `Check Roll No: ${attRoll} (Attendance - Record Not Updated)`,
          date: new Date().toISOString(),
          completed: false
        };
        setPendingWork(prev => [newWork, ...prev]);
        showToast('Added to Pending Work list', 'success');
        setAttRoll('');
      }
      return;
    }

    setAttendance(prev => {
      const copy = { ...prev };
      if (!copy[selectedDate]) copy[selectedDate] = {};
      copy[selectedDate][student.id] = attStatus;
      return copy;
    });
    showToast(`Marked ${attStudentName || student.name} as ${attStatus ? 'Present' : 'Absent'}`, 'success');
    setAttRoll('');
  };

  const toggleAttendance = (studentId) => {
    setAttendance(prev => {
      const copy = { ...prev };
      if (!copy[selectedDate]) copy[selectedDate] = {};
      const current = copy[selectedDate][studentId];
      copy[selectedDate][studentId] = current === true ? false : current === false ? undefined : true;
      return copy;
    });
  };

  const getPresentCount = (date) => {
    const dayAtt = attendance[date] || {};
    return Object.values(dayAtt).filter(status => status === true).length;
  };

  const isDateComplete = (date) => {
    const dayAtt = attendance[date] || {};
    return Object.keys(dayAtt).length === activeStudents.length;
  };

  const getStudentStatus = (studentId, date) => {
    const dayAtt = attendance[date] || {};
    if (dayAtt[studentId] === true) return 'Present';
    if (dayAtt[studentId] === false) return 'Absent';
    return 'Not Taken';
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return activeStudents;
    const lower = searchTerm.toLowerCase();
    return activeStudents.filter(s =>
      s.rollNo?.toLowerCase().includes(lower) ||
      s.name?.toLowerCase().includes(lower) ||
      (s.mobile && s.mobile.includes(lower))
    );
  }, [activeStudents, searchTerm]);

  const attStudentName = attRoll ? students.find(s => s.rollNo?.toLowerCase() === attRoll.toLowerCase())?.name : '';

  return html`<div class="space-y-6">
    <h1 class="text-2xl font-bold text-primary-gradient">📋 Attendance Management</h1>

    <div class="grid md-grid-2 gap-6">
      <!-- Mark Attendance Card -->
      <${Card} className="card-primary">
        <h3 class="font-bold text-lg mb-4 text-primary-gradient">✍️ Mark Attendance</h3>
        <form onSubmit=${markAttendance} class="space-y-4">
          <${Input} label="Date" type="date" value=${selectedDate} onChange=${e => setSelectedDate(e.target.value)} />
          <${Input} label="Roll No." value=${attRoll} onChange=${e => setAttRoll(e.target.value)} placeholder="Enter roll number" />
          ${attRoll && attStudentName && html`<p class="text-sm font-semibold text-primary">Student: ${attStudentName}</p>`}
          <div>
            <label class="input-label">Status</label>
            <select class="input-field" value=${attStatus} onChange=${e => setAttStatus(e.target.value === 'true')}>
              <option value="true">✓ Present</option>
              <option value="false">✗ Absent</option>
            </select>
          </div>
          <${Button} type="submit" variant="success" className="w-full">✓ Mark Attendance</${Button}>
        </form>
      </${Card}>

      <!-- Daily Summary Card -->
      <${Card} className="card-secondary">
        <h3 class="font-bold text-lg mb-4 text-secondary-gradient">📊 Daily Summary (Last 30 Days)</h3>
        <div class="max-h-96 overflow-y-auto space-y-2">
          ${recentDates.map(date => html`
            <div key=${date} class="flex justify-between items-center bg-gray-100 p-3 rounded-xl border hover:bg-gray-50 transition-colors">
              <span class="font-semibold">${LMS.formatDate(date)}</span>
              <div class="flex items-center gap-2">
                ${isDateComplete(date) ?
      html`<span class="text-green-600 text-lg">✓</span>` :
      html`<span class="text-red-600 text-lg">✗</span>`}
                <span class="text-sm text-gray-600 font-medium">Present: <span class="font-bold text-primary">${getPresentCount(date)}</span> / ${activeStudents.length}</span>
              </div>
            </div>
          `)}
        </div>
      </${Card}>
    </div>

    <!-- Student Grid -->
    <${Card}>
      <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 class="font-bold text-lg">👥 Students for ${LMS.formatDate(selectedDate)}</h3>
        <${Input} value=${searchTerm} onChange=${e => setSearchTerm(e.target.value)} placeholder="Search roll, name, mobile..." style=${{ maxWidth: '300px' }} />
      </div>
      
      <div class="grid grid-3 md-grid-4 xl-grid-5 gap-3">
        ${filteredStudents.map(s => {
        const status = getStudentStatus(s.id, selectedDate);
        const bgColor = status === 'Present' ? 'bg-green-100 border-green-500' :
          status === 'Absent' ? 'bg-red-100 border-red-500' :
            'bg-gray-100 border-gray-300';
        return html`
            <div key=${s.id} 
              class="p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${bgColor}"
              onClick=${() => toggleAttendance(s.id)}>
              <div class="flex items-center gap-2 mb-1">
                ${s.photo
            ? html`<img src=${s.photo} class="w-8 h-8 rounded-full object-cover" />`
            : html`<div class="w-8 h-8 rounded-full bg-pink-200 flex items-center justify-center font-bold text-pink-700">${(s.name || '?').charAt(0)}</div>`
          }
                <p class="font-bold text-sm truncate">${s.rollNo}</p>
              </div>
              <p class="text-xs truncate text-gray-600">${s.name}</p>
              <p class="text-xs font-semibold mt-1 ${status === 'Present' ? 'text-green-600' : status === 'Absent' ? 'text-red-600' : 'text-gray-500'}">
                ${status === 'Present' ? '✓ Present' : status === 'Absent' ? '✗ Absent' : '○ Not Taken'}
              </p>
            </div>
          `;
      })}
      </div>
      ${filteredStudents.length === 0 && activeStudents.length === 0 && html`<p class="text-center py-8 text-gray-500">No students found. Add students first.</p>`}
      ${filteredStudents.length === 0 && activeStudents.length > 0 && html`<p class="text-center py-8 text-gray-500">No students match your search.</p>`}
    </${Card}>
  </div>`;
};
