import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
  CreditCard,
  MapPin,
} from "lucide-react";
import IdCardScanner from "@/components/attendance/IdCardScanner";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useRbac } from "@/lib/useRbac";
import { getSettings, recordPunch } from "@/lib/attendanceService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PunchLocationPicker from "@/components/attendance/PunchLocationPicker";
import { getActiveLocations, locationLabel } from "@/lib/workLocations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAttendanceEmployees } from "@/hooks/useAttendanceEmployees";
import { attendanceBlockReason } from "@/lib/attendanceEligibility";

// While the scanner is running the attendance views refresh at most this often.
// Each refresh re-reads the whole eligible roster through the backend functions
// behind those views, so a refresh per scan is what used to exhaust the app's
// read-volume limit during a clock-in rush.
const REFRESH_THROTTLE_MS = 30000;

const STEP = {
  STANDBY: "standby",
  SCANNING: "scanning",
  PROCESSING: "processing",
  SUCCESS: "success",
  FAILED: "failed",
};

// Attendance Clock — scan an ID card to clock an employee in or out.
// Integrates with the existing AttendanceRecord/AttendancePunch system via
// recordPunch(). The punch direction (IN/OUT) is derived from today's session:
// an open session → clock OUT, otherwise → clock IN.
export default function AttendanceClock({ onRecorded }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(STEP.STANDBY);
  const [matchedEmployee, setMatchedEmployee] = useState(null);
  const [failReason, setFailReason] = useState("");
  const [successType, setSuccessType] = useState(null);
  const [successEmployee, setSuccessEmployee] = useState(null);
  const [scannerKey, setScannerKey] = useState(0);

  // Branch / work location the operator is scanning at, plus the GPS reading when
  // the branch is geofenced. The punch rules (assignment, active location,
  // geofence) are enforced in recordPunch() — this only carries the selection.
  const [workLocationId, setWorkLocationId] = useState("");
  const [coords, setCoords] = useState(null);
  // The Work Location prompt opens ONLY when a branch is actually needed — for the
  // employee being scanned at the day's first punch (clock-in) — or when the
  // supervisor taps the branch in the scanning header to set or change it.
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState(null);

  const { data: punchSettings } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000,
  });
  const { data: workLocations = [] } = useQuery({
    queryKey: ["work-locations", "active"],
    queryFn: getActiveLocations,
    staleTime: 5 * 60 * 1000,
  });
  const locationRequired = punchSettings?.require_location_on_punch === true;
  // Only prompt when there is actually something to choose on the prompt.
  const hasLocationStep =
    workLocations.length > 0 || punchSettings?.gps_verification_enabled === true;
  const selectedLocation = workLocations.find((l) => l.id === workLocationId) || null;

  const user = useCurrentUser();
  const { can } = useRbac();
  const canPunch = can('attendance.clock.use');
  const { toast } = useToast();
  const processingLockRef = useRef(false);

  // Attendance-view refresh throttle: `at` = when the views were last refreshed,
  // `timer` = the pending throttled refresh.
  const refreshRef = useRef({ at: 0, timer: null, pending: false });
  const refreshAttendanceViews = (flush = false) => {
    const state = refreshRef.current;
    const run = () => {
      state.pending = false;
      state.at = Date.now();
      // Only the affected attendance queries — never the whole module.
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      qc.invalidateQueries({ queryKey: ['attendance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['employee-summary'] });
    };
    if (flush) {
      if (state.timer) { clearTimeout(state.timer); state.timer = null; state.pending = false; }
      run();
      return;
    }
    const elapsed = Date.now() - state.at;
    if (elapsed >= REFRESH_THROTTLE_MS) { run(); return; }
    if (state.pending) return;
    state.pending = true;
    state.timer = setTimeout(run, REFRESH_THROTTLE_MS - elapsed);
  };

  // Leaving the scanner marks the views stale (one read on the next visit) and
  // never leaves a timer running.
  useEffect(() => () => {
    const state = refreshRef.current;
    if (state.timer) clearTimeout(state.timer);
    qc.invalidateQueries({ queryKey: ['time-entries'] });
    qc.invalidateQueries({ queryKey: ['attendance-dashboard'] });
    qc.invalidateQueries({ queryKey: ['employee-summary'] });
  }, [qc]);

  // Lazy-load all employees only when the scanner is active (not on page load).
  // Held for 15 minutes while scanning: a card that is not in this cached copy is
  // still resolved by exact ID against the database, so the roster does not need
  // to be re-read during a clock-in rush.
  const { data: employees = [] } = useAttendanceEmployees(
    step === STEP.SCANNING || step === STEP.PROCESSING,
    15 * 60 * 1000
  );

  // Recognition ≠ eligibility. The scanner has already established WHO the card
  // belongs to, so the eligibility rule (shared with the attendance roster —
  // @/lib/attendanceEligibility) only decides whether attendance may be
  // recorded — a recognized person is never reported as unrecognized.
  const eligibilityBlock = (emp) => attendanceBlockReason(emp);

  const handleEmployeeFound = async (emp) => {
    if (processingLockRef.current) return;
    processingLockRef.current = true;

    setMatchedEmployee(emp);

    const blocked = eligibilityBlock(emp);
    if (blocked) {
      setFailReason(blocked);
      setStep(STEP.FAILED);
      processingLockRef.current = false;
      return;
    }

    setStep(STEP.PROCESSING);

    try {
      const today = new Date().toLocaleDateString("en-CA");
      const existing = await base44.entities.AttendanceRecord.filter(
        { personnel_id: emp.id, attendance_date: today, is_deleted: { $ne: true } },
        undefined,
        100
      );
      const hasOpen = existing.some(
        (r) => r.check_in_at && !r.check_out_at && r.status === "open"
      );
      const punchType = hasOpen ? "OUT" : "IN";

      // The branch is only required to open the day (the clock-in). Break punches
      // and the final out are recorded without it, so a card never fails on the
      // way out — the scanner asks for the branch only for a first punch.
      if (punchType === "IN" && locationRequired && !workLocationId && hasLocationStep) {
        setPendingEmployee(emp);
        setShowLocationPrompt(true);
        // The lock stays held: the scanner waits for the branch before recording.
        return;
      }

      await recordScan(emp, punchType);
    } catch (err) {
      setFailReason(err.message || "Failed to record attendance.");
      setStep(STEP.FAILED);
      processingLockRef.current = false;
    }
  };

  // Records the punch for one employee and shows the result (in / out).
  const recordScan = async (emp, punchType) => {
    try {
      const result = await recordPunch({
        personnelId: emp.id,
        employeeName: emp.name,
        company: emp.company || "",
        punchType,
        timestamp: new Date(),
        source: "ID Card Scanner",
        location: emp.current_location || "",
        workLocation: emp.current_location || "",
        workLocationId,
        coords,
        currentUser: user,
      });

      // For split shifts, recordPunch returns punchKey (FIRST_IN/SECOND_IN = IN,
      // FIRST_OUT/FINAL_OUT = OUT). For normal shifts, fall back to punchType.
      const punchKey = result?.punchKey;
      const isIn = punchKey
        ? (punchKey === 'FIRST_IN' || punchKey === 'SECOND_IN')
        : (punchType === 'IN');
      setSuccessType(isIn ? 'in' : 'out');
      setSuccessEmployee(emp);
      setStep(STEP.SUCCESS);
      if (onRecorded) onRecorded();
      // Throttled: the view behind the scanner stays current without re-reading the
      // roster on every card. The last scan is flushed when scanning stops.
      refreshAttendanceViews();
      setTimeout(() => resumeForNextEmployee(), 3500);
    } catch (err) {
      setFailReason(err.message || "Failed to record attendance.");
      setStep(STEP.FAILED);
    } finally {
      processingLockRef.current = false;
    }
  };

  const resumeForNextEmployee = () => {
    setMatchedEmployee(null);
    setFailReason("");
    setSuccessType(null);
    setSuccessEmployee(null);
    setStep(STEP.SCANNING);
    setScannerKey((k) => k + 1);
  };

  const handleStop = () => {
    // Flush any pending refresh so the list behind the scanner is up to date.
    refreshAttendanceViews(true);
    setStep(STEP.STANDBY);
    setMatchedEmployee(null);
    setFailReason("");
    setSuccessType(null);
    setSuccessEmployee(null);
  };

  const beginScan = () => {
    setShowLocationPrompt(false);
    setStep(STEP.SCANNING);
    setScannerKey((k) => k + 1);
  };

  // Confirming the prompt either records the waiting employee's first punch of the
  // day or simply starts the scanner. A branch chosen here stays selected for the
  // rest of the scanning session (later punches no longer need it).
  const confirmLocation = () => {
    setShowLocationPrompt(false);
    const emp = pendingEmployee;
    if (!emp) {
      beginScan();
      return;
    }
    setPendingEmployee(null);
    recordScan(emp, "IN");
  };

  // Closing the prompt without a branch releases the waiting employee (nothing is
  // recorded for them) and returns to continuous scanning.
  const closeLocationPrompt = () => {
    setShowLocationPrompt(false);
    if (!pendingEmployee) return;
    setPendingEmployee(null);
    processingLockRef.current = false;
    resumeForNextEmployee();
  };

  // Start Scanning activates the scanner straight away. Scanning is never
  // interrupted by the branch prompt: the branch is only asked for on the first
  // punch of the day, at the moment that punch is scanned.
  const handleStart = () => beginScan();

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance Clock</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Scan an ID card to clock in or out automatically
        </p>
      </div>

      <Card className="rounded-2xl overflow-hidden min-h-[520px] flex flex-col">
        <AnimatePresence mode="wait">
          {step === STEP.STANDBY && (
            <motion.div
              key="standby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Attendance Clock</h2>
                <p className="text-muted-foreground text-sm mt-2 max-w-xs">
                  Press <strong>Start Scanning</strong> to activate the ID card
                  scanner. The system will automatically detect and record
                  attendance.
                </p>
              </div>
              {canPunch ? (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="gap-2 w-full max-w-xs text-base h-12"
                >
                  <CreditCard className="w-5 h-5" /> Start Scanning
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground max-w-xs">
                  You do not have permission to scan or punch. Contact an administrator.
                </p>
              )}
            </motion.div>
          )}

          {step === STEP.SCANNING && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col gap-4 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">Scanner Active</p>
                  <p className="text-xs text-muted-foreground">
                    Scanning continuously for employees
                  </p>
                  {/* The branch can be set or changed at any time without stopping
                      the scanner — it is only required on the first punch of the day. */}
                  <button
                    type="button"
                    onClick={() => setShowLocationPrompt(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5"
                  >
                    <MapPin className="w-3 h-3" />
                    {selectedLocation ? locationLabel(selectedLocation) : "Set work location"}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-700 font-medium">Live</span>
                </div>
              </div>
              <IdCardScanner
                key={scannerKey}
                employees={employees}
                onEmployeeFound={handleEmployeeFound}
                onStop={handleStop}
              />
            </motion.div>
          )}

          {step === STEP.PROCESSING && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <p className="font-bold text-lg">{matchedEmployee?.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Recording attendance...
                </p>
              </div>
            </motion.div>
          )}

          {step === STEP.SUCCESS && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className={`w-24 h-24 rounded-full flex items-center justify-center ${
                  successType === "in" ? "bg-emerald-100" : "bg-blue-100"
                }`}
              >
                <CheckCircle2
                  className={`w-14 h-14 ${
                    successType === "in" ? "text-emerald-500" : "text-blue-500"
                  }`}
                />
              </motion.div>
              <div>
                <p
                  className={`text-3xl font-bold ${
                    successType === "in" ? "text-emerald-600" : "text-blue-600"
                  }`}
                >
                  {successType === "in"
                    ? "Clock In Successful"
                    : "Clock Out Successful"}
                </p>
                <p className="text-xl font-semibold mt-2">
                  {successEmployee?.name}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {[successEmployee?.department, successEmployee?.company]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-2xl font-bold mt-3 text-foreground">
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Thank you! Preparing for next scan...
                </p>
              </div>
            </motion.div>
          )}

          {step === STEP.FAILED && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
              <div>
                {matchedEmployee?.name && (
                  <p className="text-sm font-semibold">{matchedEmployee.name}</p>
                )}
                <p className="text-xl font-bold text-red-600">Cannot Process</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  {failReason}
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={resumeForNextEmployee} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Continue Scanning
                </Button>
                <Button onClick={handleStop} variant="outline">
                  Stop
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Dialog
        open={showLocationPrompt}
        onOpenChange={(open) => { if (!open) closeLocationPrompt(); }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Work Location</DialogTitle>
            <DialogDescription>
              {pendingEmployee
                ? `The work location is required for ${pendingEmployee.name}'s first punch of the day.`
                : 'Select the branch you are scanning at. It is recorded with the first punch of the day — First Out, Second In and Final Out never need it.'}
            </DialogDescription>
          </DialogHeader>

          <PunchLocationPicker
            locations={workLocations}
            settings={punchSettings}
            value={workLocationId}
            onChange={setWorkLocationId}
            coords={coords}
            onCoordsChange={setCoords}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeLocationPrompt}>
              {pendingEmployee ? "Skip this employee" : "Cancel"}
            </Button>
            <Button onClick={confirmLocation} className="gap-2">
              <MapPin className="w-4 h-4" /> {pendingEmployee ? "Record Punch" : "Save Branch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}