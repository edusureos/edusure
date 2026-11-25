import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  HeartPulse,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { fetchAttendance } from './attendance-api';
import './attendance-page.css';

const STATUS_OPTIONS = [
  { id: 'PRESENT', label: 'Present', icon: Check, color: 'green' },
  { id: 'ABSENT', label: 'Absent', icon: XCircle, color: 'red' },
  { id: 'HALF_DAY', label: 'Half day', icon: Clock3, color: 'amber' },
  { id: 'MEDICAL', label: 'Medical', icon: HeartPulse, color: 'blue' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const NO_RECORDS = Object.freeze([]);
const MONTH_FORMAT = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
const DATE_FORMAT = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function localDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function statusLabel(status) {
  if (status === 'PRESENT') return 'Present';
  if (status === 'LATE') return 'Present';
  if (status === 'ABSENT') return 'Absent';
  if (status === 'HALF_DAY') return 'Half day';
  if (status === 'MEDICAL') return 'Medical';
  return 'Recorded';
}

function makeCalendarDays(monthDate, records) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOffset = (localDate(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = localDate(year, month + 1, 0).getDate();
  const weeks = Math.ceil((firstDayOffset + daysInMonth) / 7);
  const byDate = new Map(records.map((record) => [record.date, record]));
  const days = Array.from({ length: weeks * 7 }, (_, index) => {
    const dayNumber = index - firstDayOffset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    const date = localDate(year, month, dayNumber);
    return { date, record: byDate.get(dateKey(date)) || null };
  });
  return { days, weeks };
}

function getCounts(records) {
  return records.reduce(
    (counts, record) => {
      const status = record.status.toUpperCase();
      if (status === 'PRESENT' || status === 'LATE') counts.present += 1;
      else if (status === 'ABSENT') counts.absent += 1;
      else if (status === 'HALF_DAY') counts.halfDay += 1;
      else if (status === 'MEDICAL') counts.medical += 1;
      return counts;
    },
    { present: 0, absent: 0, halfDay: 0, medical: 0 },
  );
}

function StatusSummaryCard({ option, count, percentage, isTracked, isSelected, onClick }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      className={`attendance-summary-card status-${option.color}${isSelected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
      title={`Filter attendance by ${option.label.toLowerCase()}`}
    >
      <span className="attendance-summary-icon"><Icon size={18} /></span>
      <span className="attendance-summary-label">{option.label}</span>
      <strong className="attendance-summary-value">{isTracked ? count : '—'}</strong>
      <span className="attendance-summary-foot">
        {isTracked ? `${percentage}% of recorded days` : 'Not tracked in records'}
      </span>
    </button>
  );
}

function AttendanceDonut({ segments, percentage }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;

  return (
    <div
      className="attendance-donut-wrap"
      role="img"
      aria-label={percentage === null ? 'Attendance percentage unavailable' : `${percentage}% attendance`}
    >
      <svg className="attendance-donut" viewBox="0 0 128 128" aria-hidden="true">
        <circle className="attendance-donut-track" cx="64" cy="64" r={radius} />
        {total > 0 && segments.map((segment) => {
          if (!segment.value) return null;
          const length = (segment.value / total) * circumference;
          const circle = (
            <circle
              key={segment.id}
              className={`attendance-donut-segment segment-${segment.color}`}
              cx="64"
              cy="64"
              r={radius}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return circle;
        })}
      </svg>
      <div className="attendance-donut-center">
        <strong>{percentage === null ? '—' : `${percentage}%`}</strong>
        <span>Attendance</span>
      </div>
    </div>
  );
}

export default function AttendancePage({ onBack }) {
  const [today] = useState(() => new Date());
  const [monthDate, setMonthDate] = useState(() => {
    return localDate(today.getFullYear(), today.getMonth(), 1);
  });
  const [monthData, setMonthData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchAttendance(monthDate, controller.signal)
      .then(setMonthData)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [monthDate, reloadKey]);

  const records = monthData?.records || NO_RECORDS;
  const counts = useMemo(() => getCounts(records), [records]);
  const totalDays = monthData?.totalDays ?? records.length;
  const knownRecordDays = records.length;
  const attendanceUnits = counts.present + counts.halfDay * 0.5;
  const attendancePercentage = totalDays > 0
    ? Math.round((attendanceUnits / totalDays) * 100)
    : 0;
  const isDataAvailable = !isLoading && !error;
  const { days, weeks } = useMemo(() => makeCalendarDays(monthDate, records), [monthDate, records]);
  const selectedRecord = selectedDate
    ? records.find((record) => record.date === dateKey(selectedDate)) || null
    : null;
  const selectedDateIsFuture = selectedDate ? selectedDate > today : false;
  const trackedCount = (option) => {
    if (option.id === 'PRESENT') return counts.present;
    if (option.id === 'ABSENT') return counts.absent;
    if (option.id === 'HALF_DAY') return counts.halfDay;
    return counts.medical;
  };
  const isStatusTracked = (option) => ['PRESENT', 'ABSENT'].includes(option.id)
    || records.some((record) => record.status.toUpperCase() === option.id);
  const chartSegments = [
    { id: 'present', label: 'Present', color: 'green', value: counts.present },
    { id: 'absent', label: 'Absent', color: 'red', value: counts.absent },
    { id: 'half-day', label: 'Half day', color: 'amber', value: counts.halfDay },
    { id: 'medical', label: 'Medical', color: 'blue', value: counts.medical },
  ];
  const monthName = MONTH_FORMAT.format(monthDate);
  const isCurrentMonth = monthDate.getFullYear() === today.getFullYear()
    && monthDate.getMonth() === today.getMonth();
  const isFutureMonth = monthDate > localDate(today.getFullYear(), today.getMonth(), 1);
  const isEmpty = !isLoading && !error && knownRecordDays === 0;

  function resetMonthView() {
    setMonthData(null);
    setIsLoading(true);
    setError('');
    setActiveFilter(null);
    setSelectedDate(null);
  }

  function selectMonth(date) {
    const firstOfMonth = localDate(date.getFullYear(), date.getMonth(), 1);
    if (firstOfMonth > localDate(today.getFullYear(), today.getMonth(), 1)) return;
    setMonthDate(firstOfMonth);
    resetMonthView();
  }

  function changeMonth(offset) {
    setMonthDate((current) => {
      const next = localDate(current.getFullYear(), current.getMonth() + offset, 1);
      return next > localDate(today.getFullYear(), today.getMonth(), 1) ? current : next;
    });
    resetMonthView();
  }

  function handleMonthChange(value) {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return;
    selectMonth(localDate(year, month - 1, 1));
  }

  function showCurrentMonth() {
    selectMonth(today);
  }

  function selectFilter(status) {
    setActiveFilter((current) => current === status ? null : status);
    setSelectedDate(null);
  }

  function retry() {
    setMonthData(null);
    setIsLoading(true);
    setError('');
    setSelectedDate(null);
    setReloadKey((key) => key + 1);
  }

  return (
    <main className="attendance-page">
      <div className="attendance-page-header">
        <div>
          <div className="attendance-breadcrumb">
            <button type="button" onClick={onBack} className="attendance-back-button">
              <ArrowLeft size={15} /> Dashboard
            </button>
            <ChevronRight size={14} />
            <span>Attendance</span>
          </div>
          <h1>My Attendance</h1>
          <p>Track your attendance, monitor your progress and stay consistent.</p>
        </div>
      </div>

      {error && (
        <div className="attendance-alert" role="alert">
          <CircleAlert size={18} />
          <span>{error}</span>
          <button type="button" onClick={retry}><RefreshCw size={15} /> Retry</button>
        </div>
      )}

      <section className="attendance-summary-grid" aria-label={`${monthName} attendance summary`}>
        {STATUS_OPTIONS.map((option) => (
          <StatusSummaryCard
            key={option.id}
            option={option}
            count={trackedCount(option)}
            percentage={totalDays ? Math.round((trackedCount(option) / totalDays) * 100) : 0}
            isTracked={!isLoading && !error && isStatusTracked(option)}
            isSelected={activeFilter === option.id}
            onClick={() => selectFilter(option.id)}
          />
        ))}
      </section>

      {activeFilter && (
        <div className="attendance-filter-bar" role="status">
          <span>Showing {STATUS_OPTIONS.find((option) => option.id === activeFilter)?.label.toLowerCase()} dates</span>
          <button type="button" onClick={() => setActiveFilter(null)}>
            <X size={14} /> Show all attendance
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="attendance-empty-banner" role="status">
          <CalendarDays size={19} />
          <div>
            <strong>Your attendance records will appear here.</strong>
            <span>No records have been marked for {monthName}.</span>
          </div>
        </div>
      )}

      <div className="attendance-content-grid">
        <section className="attendance-panel attendance-calendar-panel">
          <div className="attendance-panel-heading">
            <div>
              <h2>Monthly attendance</h2>
              <p>{isLoading ? 'Loading attendance records…' : error ? 'Attendance records unavailable' : `${knownRecordDays} recorded ${knownRecordDays === 1 ? 'day' : 'days'} in ${monthName}`}</p>
            </div>
            <div className="attendance-month-control" aria-label="Attendance month">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={18} />
              </button>
              <label className="attendance-month-picker">
                <CalendarDays size={15} aria-hidden="true" />
                <input
                  type="month"
                  value={monthInputValue(monthDate)}
                  max={monthInputValue(today)}
                  onChange={(event) => handleMonthChange(event.target.value)}
                  aria-label="Choose attendance month"
                />
              </label>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
                disabled={isCurrentMonth || isFutureMonth}
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                className="attendance-current-month"
                onClick={showCurrentMonth}
                disabled={isCurrentMonth}
              >
                Current month
              </button>
            </div>
          </div>

          <div className="attendance-calendar-scroll">
            <div
              className="attendance-calendar"
              style={{ '--attendance-weeks': weeks }}
              aria-label={`${monthName} attendance calendar`}
            >
              <div className="attendance-weekday-labels" aria-hidden="true">
                {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="attendance-calendar-grid">
                {days.map((item, index) => {
                  if (!item) return <span className="attendance-calendar-placeholder" key={`empty-${index}`} />;
                  const key = dateKey(item.date);
                  const isFuture = item.date > today;
                  const recordStatus = item.record?.status.toUpperCase();
                  const status = (recordStatus === 'LATE' ? 'PRESENT' : recordStatus)
                    || (isLoading ? 'LOADING' : error ? 'UNAVAILABLE' : isFuture ? 'FUTURE' : 'NO_RECORD');
                  const matchesFilter = !activeFilter
                    || status === activeFilter;
                  const dayStatus = item.record
                    ? statusLabel(status)
                    : isLoading
                      ? 'Loading attendance'
                      : error
                        ? 'Attendance unavailable'
                        : isFuture
                          ? 'Future date'
                          : 'No record';
                  const tooltip = `${DATE_FORMAT.format(item.date)} · ${item.date.toLocaleDateString('en', { weekday: 'long' })} · ${dayStatus}`;
                  const isSelected = selectedDate && dateKey(selectedDate) === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`attendance-day status-${status.toLowerCase().replace('_', '-')} ${matchesFilter ? '' : 'is-dimmed'}${isSelected ? ' is-selected' : ''}`}
                      onClick={() => setSelectedDate(item.date)}
                      title={tooltip}
                      aria-label={tooltip}
                      aria-pressed={Boolean(isSelected)}
                      disabled={isLoading || Boolean(error)}
                      style={{ gridColumn: (index % 7) + 1, gridRow: Math.floor(index / 7) + 1 }}
                    >
                      <span>{item.date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="attendance-legend" aria-label="Attendance status legend">
            {[
              ['PRESENT', 'Present'],
              ['ABSENT', 'Absent'],
              ['HALF_DAY', 'Half day'],
              ['MEDICAL', 'Medical'],
              ['NO_RECORD', 'No record'],
              ['FUTURE', 'Future'],
            ].map(([status, label]) => (
              <span key={status}><i className={`status-${status.toLowerCase().replace('_', '-')}`} />{label}</span>
            ))}
          </div>

          {selectedDate && (
            <div className="attendance-day-details" aria-live="polite">
              <div>
                <span className="attendance-detail-date">{DATE_FORMAT.format(selectedDate)}</span>
                <strong>{selectedDate.toLocaleDateString('en', { weekday: 'long' })}</strong>
              </div>
              <span className={`attendance-detail-status status-${(selectedRecord?.status.toLowerCase().replace('_', '-')) || (selectedDateIsFuture ? 'future' : 'no-record')}`}>
                {selectedRecord
                  ? statusLabel(selectedRecord.status.toUpperCase())
                  : selectedDateIsFuture
                    ? 'Future date'
                    : 'No attendance record'}
              </span>
              {selectedRecord?.remarks && <p>{selectedRecord.remarks}</p>}
              {!selectedRecord && !selectedDateIsFuture && <p>Attendance has not been recorded for this date.</p>}
            </div>
          )}

          {activeFilter && !isLoading && !error && trackedCount(STATUS_OPTIONS.find((option) => option.id === activeFilter)) === 0 && (
            <p className="attendance-filter-empty">
              {isStatusTracked(STATUS_OPTIONS.find((option) => option.id === activeFilter))
                ? `No ${STATUS_OPTIONS.find((option) => option.id === activeFilter).label.toLowerCase()} days are recorded this month.`
                : `${STATUS_OPTIONS.find((option) => option.id === activeFilter).label} is not tracked by the current attendance records.`}
            </p>
          )}
        </section>

        <section className="attendance-panel attendance-analytics-panel">
          <div className="attendance-panel-heading">
            <div>
              <h2>Attendance analytics</h2>
              <p>Based on recorded working days</p>
            </div>
          </div>

          <AttendanceDonut
            segments={chartSegments}
            percentage={isDataAvailable ? attendancePercentage : null}
          />

          <div className="attendance-chart-legend">
            {chartSegments.map((segment) => {
              const value = segment.value;
              const percentageValue = totalDays ? Math.round((value / totalDays) * 100) : 0;
              const isTracked = ['present', 'absent'].includes(segment.id)
                || (segment.id === 'half-day' && isStatusTracked({ id: 'HALF_DAY' }))
                || (segment.id === 'medical' && isStatusTracked({ id: 'MEDICAL' }));
              return (
                <div className="attendance-chart-row" key={segment.id}>
                  <span className={`attendance-chart-dot segment-${segment.color}`} />
                  <span className="attendance-chart-label">{segment.label}</span>
                  <strong>{isDataAvailable && isTracked ? value : '—'}</strong>
                  <span>{isDataAvailable && isTracked && totalDays ? `${percentageValue}%` : '—'}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

    </main>
  );
}
