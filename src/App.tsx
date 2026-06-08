import { useEffect, useMemo, useRef, useState } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from './lib/supabase'

    const [elapsed, setElapsed] = useState(0)
    const location = useLocation()
    const navigate = useNavigate()

    const [localStart, setLocalStart] = useState<Date | null>(activeSessionStart)
    const [localSeat, setLocalSeat] = useState<Seat | null>(activeSessionSeat)
    const [localZone, setLocalZone] = useState<Zone | null>(activeSessionZone)
    const [loadingLocal, setLoadingLocal] = useState(false)

    // If App-level session is not set, attempt to read route state and fetch seat details
    useEffect(() => {
      if (activeSessionStart) return

      const state: any = (location && (location as any).state) || {}
      if (!state?.reservationId && !state?.seatId) {
        navigate('/', { replace: true })
        return
      }

      setLoadingLocal(true)
      ;(async () => {
        try {
          let seat: Seat | null = localSeat
          let zone: Zone | null = localZone

          // Resolve seat id from reservation if necessary
          let seatId = state?.seatId
          if (!seatId && state?.reservationId) {
            const { data: resData } = await supabase
              .from('reservations')
              .select('seat_id')
              .eq('id', state.reservationId)
              .maybeSingle()
            seatId = resData?.seat_id
          }

          if (seatId) {
            const { data: seatData } = await supabase.from('seats').select('*').eq('id', seatId).maybeSingle()
            seat = seatData || null
            setLocalSeat(seat)
          }

          if (!zone) {
            if (state?.zone) zone = state.zone
            else if (seat?.zone_id) zone = HARDCODED_ZONES.find((z) => String(z.id) === String(seat.zone_id)) || null
            setLocalZone(zone)
          }

          if (!localStart) {
            if (state?.startedAt) setLocalStart(new Date(state.startedAt))
            else setLocalStart(new Date())
          }
        } catch (err) {
          navigate('/', { replace: true })
        } finally {
          setLoadingLocal(false)
        }
      })()
    }, [])

    const displayStart = activeSessionStart || localStart
    const displaySeat = activeSessionSeat || localSeat
    const displayZone = activeSessionZone || localZone

    useEffect(() => {
      if (!displayStart) return

      const updateElapsed = () => {
        setElapsed(Math.floor((Date.now() - displayStart.getTime()) / 1000))
      }

      updateElapsed()
      const timer = window.setInterval(updateElapsed, 1000)

      return () => window.clearInterval(timer)
    }, [displayStart])

    if (!displayStart && !loadingLocal) {
      return (
        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 text-center text-slate-300 shadow-xl shadow-black/30">
          <p className="text-lg text-slate-300">No active session found.</p>
          <p className="mt-3 text-sm text-slate-500">Reserve a seat and check in to start tracking your session.</p>
        </div>
      )
    }

    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">Active session</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Your study session</h2>
            </div>
            <div className="rounded-3xl bg-gradient-to-r from-teal-600/20 to-teal-400/10 p-4 text-right">
              <p className="text-sm uppercase tracking-[0.35em] text-teal-200/80">Elapsed</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatCountdown(elapsed)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-900/80 p-5">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Seat</p>
              <p className="mt-3 text-xl font-semibold text-white">
                {displaySeat?.seat_number || displaySeat?.label || 'Unknown'}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-5">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Zone</p>
              <p className="mt-3 text-xl font-semibold text-white">{displayZone?.name || 'Unknown'}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-5">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Started</p>
              <p className="mt-3 text-xl font-semibold text-white">
                {displayStart?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
  const [currentReservation, setCurrentReservation] = useState<{
    reservationId: string | number
    seat: Seat
    zone: Zone
    expiresAt: string
  } | null>(null)
  const [reservationOpen, setReservationOpen] = useState(false)
  const [countdown, setCountdown] = useState(900)
  const [activeSessionStart, setActiveSessionStart] = useState<Date | null>(null)
  const [activeSessionSeat, setActiveSessionSeat] = useState<Seat | null>(null)
  const [activeSessionZone, setActiveSessionZone] = useState<Zone | null>(null)
  const [activeSessionReservationId, setActiveSessionReservationId] = useState<string | number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        handleSession(data.session.user.email || null)
      }
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, sessionData) => {
        const email = sessionData?.user?.email || null
        await handleSession(email)
      },
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userEmail) return
    releaseExpiredReservations()
    loadDashboardData()
    const interval = window.setInterval(() => {
      releaseExpiredReservations()
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [userEmail])

  useEffect(() => {
    if (!reservationOpen) return undefined

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          expireReservation()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [reservationOpen])

  const seatSummary = useMemo(() => {
    const summary = {
      free: 0,
      occupied: 0,
      reserved: 0,
      blocked: 0,
    }

    seatList.forEach((seat) => {
      const status = (seat.status || 'free').toLowerCase()
      if (status in summary) {
        summary[status as keyof typeof summary] += 1
      } else {
        summary.free += 1
      }
    })

    return summary
  }, [seatList])

  const login = async () => {
    setStatusMessage('Redirecting to Google sign-in...')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      setStatusMessage(`Sign-in failed: ${error.message}`)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setSession(false)
    setUserEmail(null)
    setIsAdmin(false)
    setUserFirstName('Guest')
    setStatusMessage('Signed out successfully.')
  }

  const handleSession = async (email: string | null) => {
    if (!email) {
      setSession(false)
      setUserEmail(null)
      setIsAdmin(false)
      setUserFirstName('Guest')
      return
    }

    if (!BITS_DOMAIN.test(email)) {
      await supabase.auth.signOut()
      setStatusMessage('Please sign in with a BITS Pilani Hyderabad email.')
      setSession(false)
      setUserEmail(null)
      setIsAdmin(false)
      return
    }

    setSession(true)
    setUserEmail(email)
    setStatusMessage(null)

    // Try to read the user's display name from the auth session metadata
    try {
      const { data: authUser } = await supabase.auth.getUser()
      const meta = (authUser as any)?.user?.user_metadata || {}
      const fullName = meta.full_name || meta.name || ''
      const first = fullName ? String(fullName).split(' ')[0] : (email ? String(email).split('@')[0] : 'Guest')
      setUserFirstName(first)
    } catch (err) {
      const first = email ? String(email).split('@')[0] : 'Guest'
      setUserFirstName(first)
    }

    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('email', email)
      .maybeSingle()

    setIsAdmin(!error && data?.is_admin === true)
  }

  const loadDashboardData = async () => {
    setLoadingData(true)
    try {
      const zoneIds = HARDCODED_ZONES.map((zone) => zone.id)
      const zoneResponse = await supabase
        .from('zones')
        .select('id,name,description')
        .in('id', zoneIds)
      const seatResponse = await supabase.from('seats').select('*')
      const reservationResponse = await supabase
        .from('reservations')
        .select('id,seat_id,status,created_at,user_email')

      console.log('Supabase zones response', zoneResponse)
      console.log('Supabase seats response', seatResponse)
      console.log('Supabase reservations response', reservationResponse)
      console.log('Supabase env', {
        url: import.meta.env.VITE_SUPABASE_URL,
        hasAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
      })

      ;(window as any).__LIBRA_DEBUG__ = {
        zoneResponse,
        seatResponse,
        reservationResponse,
        env: {
          url: import.meta.env.VITE_SUPABASE_URL,
          hasAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
        },
      }

      const seats = seatResponse.data || []
      console.log('Raw seats array', seats)
      const freeCounts = seats.reduce((acc: Record<string, number>, seat) => {
        if (seat.status?.toLowerCase() === 'free') {
          const zoneKey = String(seat.zone_id)
          acc[zoneKey] = (acc[zoneKey] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      setZones(HARDCODED_ZONES)
      setSeatList(seats)
      setReservations(reservationResponse.data || [])
      setZoneFreeCounts(freeCounts)
    } finally {
      setLoadingData(false)
    }
  }

  const openSeatModal = (seat: Seat) => {
    const zone = HARDCODED_ZONES.find((zone) => String(zone.id) === String(seat.zone_id)) || null
    setSelectedSeat(seat)
    setSelectedZone(zone)
  }

  const closeSeatModal = () => {
    setSelectedSeat(null)
    setSelectedZone(null)
  }

  const expireReservation = async () => {
    if (!currentReservation) return
    setReservationOpen(false)
    setCountdown(900)
    const seatId = currentReservation.seat.id
    await supabase.from('reservations').delete().eq('id', currentReservation.reservationId)
    await supabase.from('seats').update({ status: 'free' }).eq('id', seatId)
    setCurrentReservation(null)
    setStatusMessage('Reservation expired and seat is now free.')
    loadDashboardData()
    return
  }

  const releaseExpiredReservations = async () => {
    const now = new Date().toISOString()
    const { data: expiredReservations, error } = await supabase
      .from('reservations')
      .select('id,seat_id')
      .lt('expires_at', now)
      .eq('checked_in', false)

    if (error) {
      console.error('Expired reservation cleanup failed:', error)
      return
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      return
    }

    const expiredIds = expiredReservations.map((reservation) => reservation.id)

    await Promise.all(
      expiredReservations.map(async (reservation) => {
        if (reservation.seat_id != null) {
          await supabase.from('seats').update({ status: 'free' }).eq('id', reservation.seat_id)
        }
        await supabase.from('reservations').delete().eq('id', reservation.id)
      }),
    )

    setCurrentReservation((prev) => {
      if (prev && expiredIds.includes(prev.reservationId)) {
        setReservationOpen(false)
        setCountdown(900)
        return null
      }
      return prev
    })

    setStatusMessage('Expired reservations released.')
    loadDashboardData()
  }

  const reserveSeat = async () => {
    if (!selectedSeat) return
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (userError || !userId) {
      setStatusMessage('Unable to reserve seat. Please sign in again.')
      return
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()

    const { data: reservationData, error: reservationError } = await supabase
      .from('reservations')
      .insert([
        {
          seat_id: selectedSeat.id,
          user_id: userId,
          created_at: now.toISOString(),
          expires_at: expiresAt,
          checked_in: false,
        },
      ])
      .select()
      .single()

    if (reservationError || !reservationData) {
      setStatusMessage(`Could not create reservation: ${reservationError?.message || 'unknown error'}`)
      return
    }

    const { error: seatUpdateError } = await supabase
      .from('seats')
      .update({ status: 'reserved' })
      .eq('id', selectedSeat.id)

    if (seatUpdateError) {
      setStatusMessage(`Could not reserve seat: ${seatUpdateError.message}`)
      return
    }

    const reservationId = reservationData.id
    const zone = selectedZone || HARDCODED_ZONES.find((zone) => String(zone.id) === String(selectedSeat.zone_id))
    setCurrentReservation({
      reservationId,
      seat: { ...selectedSeat, status: 'reserved' },
      zone: zone || {
        id: selectedSeat.zone_id || '',
        name: 'Unknown zone',
        description: '',
      },
      expiresAt,
    })
    setReservationOpen(true)
    setCountdown(15 * 60)
    setActiveSessionSeat(null)
    setActiveSessionZone(null)
    closeSeatModal()
    loadDashboardData()
    setStatusMessage('Seat reserved. Continue to the timer to check in.')
    navigate('/reservation')
    return
  }

  const cancelReservation = async () => {
    if (!currentReservation) return
    const seatId = currentReservation.seat.id
    await supabase.from('reservations').delete().eq('id', currentReservation.reservationId)
    await supabase.from('seats').update({ status: 'free' }).eq('id', seatId)
    setCurrentReservation(null)
    setReservationOpen(false)
    setCountdown(900)
    setStatusMessage('Reservation cancelled.')
    loadDashboardData()
    return
  }

  const checkIn = async () => {
    if (!currentReservation) return null

    await supabase
      .from('reservations')
      .update({ checked_in: true })
      .eq('id', currentReservation.reservationId)
    await supabase
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', currentReservation.seat.id)

    const startedAt = new Date()
    setActiveSessionStart(startedAt)
    setActiveSessionSeat({ ...currentReservation.seat, status: 'occupied' })
    setActiveSessionZone(currentReservation.zone)
    setActiveSessionReservationId(currentReservation.reservationId)
    setCurrentReservation(null)
    setReservationOpen(false)
    setCountdown(900)
    setStatusMessage('Checked in successfully.')
    loadDashboardData()

    // return session info so callers can navigate with state if needed
    return {
      reservationId: currentReservation.reservationId,
      seatId: currentReservation.seat.id,
      zone: currentReservation.zone,
      startedAt: startedAt.toISOString(),
    }
  }

  const toggleSeatBlock = async (seatId: number | string) => {
    const seat = seatList.find((item) => String(item.id) === String(seatId))
    if (!seat) {
      setStatusMessage('Seat not found.')
      return
    }

    const isBlocked = seat.blocked === true || seat.status?.toLowerCase() === 'blocked'
    setStatusMessage(isBlocked ? 'Unblocking seat...' : 'Blocking seat...')
    const { error } = await supabase
      .from('seats')
      .update(
        isBlocked
          ? { blocked: false, status: 'free' }
          : { blocked: true, status: 'blocked' },
      )
      .eq('id', seatId)

    if (error) {
      setStatusMessage(`Unable to ${isBlocked ? 'unblock' : 'block'} seat: ${error.message}`)
      return
    }

    setStatusMessage(isBlocked ? 'Seat unblocked successfully.' : 'Seat blocked successfully.')
    loadDashboardData()
  }

  const forceReleaseSeat = async (seatId: number | string) => {
    setStatusMessage('Force releasing seat...')
    await supabase.from('seats').update({ status: 'free', blocked: false }).eq('id', seatId)
    await supabase.from('reservations').delete().eq('seat_id', seatId)

    setCurrentReservation((prev) => {
      if (prev?.seat.id === seatId) {
        setReservationOpen(false)
        setCountdown(900)
        return null
      }
      return prev
    })

    if (activeSessionSeat?.id === seatId) {
      setActiveSessionStart(null)
      setActiveSessionSeat(null)
      setActiveSessionZone(null)
      setActiveSessionReservationId(null)
    }

    setStatusMessage('Seat released successfully.')
    loadDashboardData()
  }

  const vacate = async () => {
    const seatId = activeSessionSeat?.id
    const reservationId = activeSessionReservationId

    if (seatId != null) {
      await supabase.from('seats').update({ status: 'free' }).eq('id', seatId)
    }

    if (reservationId != null) {
      await supabase.from('reservations').delete().eq('id', reservationId)
    }

    setActiveSessionStart(null)
    setActiveSessionSeat(null)
    setActiveSessionZone(null)
    setActiveSessionReservationId(null)
    setStatusMessage('Seat released. Thanks!')
    loadDashboardData()
    navigate('/')
  }

  const greeting = userFirstName || (userEmail ? userEmail.split('@')[0] : 'Guest')

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-6">
          <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_15px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">
                LibraSeat
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Library seat tracking for BITS Hyderabad
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {session ? (
                <>
                  <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-200">
                    {userEmail}
                  </span>
                  <button
                    onClick={logout}
                    className="rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  onClick={login}
                  className="rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </header>

          {session && (
            <nav className="mb-6 flex flex-wrap gap-2">
              <NavLink to="/" className={navLinkClass} end>
                Dashboard
              </NavLink>
              <NavLink to="/seat-map" className={navLinkClass}>
                Seat map
              </NavLink>
              <NavLink to="/reservation" className={navLinkClass}>
                Reservation timer
              </NavLink>
              <NavLink to="/active-session" className={navLinkClass}>
                Active session
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={navLinkClass}>
                  Admin panel
                </NavLink>
              )}
            </nav>
          )}

          {statusMessage && (
            <div className="mb-6 rounded-3xl border border-teal-500/30 bg-slate-900/80 px-5 py-4 text-sm text-teal-200 shadow-lg shadow-teal-500/10">
              {statusMessage}
            </div>
          )}

          <Routes>
            <Route
              path="/login"
              element={
                session ? (
                  <Navigate to="/" replace />
                ) : (
                  <LoginScreen login={login} message={statusMessage} />
                )
              }
            />
            <Route
              path="/"
              element={
                session ? (
                  <HomeScreen
                    greeting={greeting}
                    zones={zones}
                    zoneFreeCounts={zoneFreeCounts}
                    summary={seatSummary}
                    loading={loadingData}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/seat-map/:zoneId?"
              element={
                session ? (
                  <SeatMapScreen
                    seats={seatList}
                    zones={zones}
                    loading={loadingData}
                    onSelectSeat={openSeatModal}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/reservation"
              element={
                session ? (
                  <ReservationScreen
                    currentReservation={currentReservation}
                    countdown={countdown}
                    cancelReservation={cancelReservation}
                    checkIn={checkIn}
                    setStatusMessage={setStatusMessage}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/active-session"
              element={
                session ? (
                  <ActiveSessionScreen
                    activeSessionStart={activeSessionStart}
                    activeSessionSeat={activeSessionSeat}
                    activeSessionZone={activeSessionZone}
                    vacate={vacate}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/admin"
              element={
                session ? (
                  isAdmin ? (
                    <AdminScreen
                      seats={seatList}
                      zones={zones}
                      reservations={reservations}
                      summary={seatSummary}
                      loading={loadingData}
                      blockSeat={toggleSeatBlock}
                      forceRelease={forceReleaseSeat}
                    />
                  ) : (
                    <AdminRestricted />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
          </Routes>

          {selectedSeat && selectedZone && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-md sm:items-center">
              <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">Reserve this seat</p>
                    <h2 className="mt-3 text-3xl font-semibold text-white">{selectedZone.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">{selectedZone.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSeatModal}
                    className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-300 transition hover:border-teal-500/50 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 rounded-3xl bg-slate-900/80 p-6">
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Seat</p>
                  <p className="mt-2 text-4xl font-semibold text-white">
                    {selectedSeat.seat_number || selectedSeat.label || String(selectedSeat.id)}
                  </p>
                  <p className="mt-3 text-sm text-slate-300">Click reserve to hold this seat for 15 minutes.</p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeSeatModal}
                    className="rounded-3xl border border-white/10 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-teal-500/50 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={reserveSeat}
                    className="rounded-3xl bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
                  >
                    Reserve this seat
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
}

function LoginScreen({
  login,
  message,
}: {
  login: () => void
  message: string | null
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="space-y-5">
        <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">
          Welcome back
        </p>
        <h2 className="text-4xl font-semibold text-white">
          Log in with your BITS Hyderabad account.
        </h2>
        <p className="max-w-2xl text-sm text-slate-300">
          Access real-time zone capacity, reserve a seat, track active sessions,
          and manage seats when you are an admin.
        </p>
        <button
          onClick={login}
          className="inline-flex items-center justify-center rounded-3xl bg-teal-500 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
        >
          Sign in with Google
        </button>
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-300">
          <p className="font-medium text-slate-100">BITS email required</p>
          <p>Only accounts with a BITS Pilani Hyderabad email can continue.</p>
        </div>
        {message && <p className="text-sm text-rose-300">{message}</p>}
      </div>
    </div>
  )
}

function HomeScreen({
  greeting,
  zones,
  summary,
  loading,
  zoneFreeCounts,
}: {
  greeting: string
  zones: Zone[]
  summary: { free: number; occupied: number; reserved: number; blocked: number }
  loading: boolean
  zoneFreeCounts: Record<string, number>
}) {
  const navigate = useNavigate()
  const freeSeatCount = (zoneId: number | string) =>
    zoneFreeCounts[String(zoneId)] ?? 0

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 shadow-xl shadow-black/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">
              Good to see you back
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Hello, {greeting}</h2>
          </div>
          <div className="rounded-3xl bg-gradient-to-r from-teal-600/20 to-teal-400/10 p-4 text-right">
            <p className="text-sm uppercase tracking-[0.35em] text-teal-200/80">
              Live seat counts
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{summary.free} seats available</p>
            <p className="text-sm text-slate-300">Refreshes automatically from Supabase.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {zones.length ? (
          zones.map((zone) => (
            <div
              key={zone.id}
              onClick={() => navigate(`/seat-map/${zone.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  navigate(`/seat-map/${zone.id}`)
                }
              }}
              className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.8)] transition hover:border-teal-500/40 hover:bg-slate-900/80 hover:cursor-pointer"
            >
              <p className="text-sm uppercase tracking-[0.35em] text-teal-300/70">{zone.name}</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{zone.name}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">{zone.description}</p>
              <div className="mt-6 flex items-center justify-between rounded-3xl bg-[#111827] px-4 py-4">
                <span className="text-sm uppercase tracking-[0.3em] text-slate-400">Available</span>
                <span className="text-2xl font-semibold text-teal-300">
                  {loading ? '—' : freeSeatCount(zone.id)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-3xl border border-white/10 bg-slate-950/80 p-10 text-center text-slate-300">
            {loading ? 'Loading zone data...' : 'No zone data available.'}
          </div>
        )}
      </section>
    </div>
  )
}

function SeatMapScreen({
  seats,
  zones,
  loading,
  onSelectSeat,
}: {
  seats: Seat[]
  zones: Zone[]
  loading: boolean
  onSelectSeat: (seat: Seat) => void
}) {
  const { zoneId } = useParams<{ zoneId?: string }>()
  const selectedZone = zoneId
    ? zones.find((zone) => String(zone.id) === String(zoneId))
    : null
  const seatGrid = seats.filter(
    (seat) => !zoneId || String(seat.zone_id) === String(zoneId),
  )

  const colorClass = (seat: Seat) => {
    if (seat.blocked === true || seat.status?.toLowerCase() === 'blocked') {
      return 'bg-slate-700/90 ring-slate-500/70'
    }

    switch (seat.status?.toLowerCase()) {
      case 'occupied':
        return 'bg-rose-500/90 ring-rose-400/50'
      case 'reserved':
        return 'bg-amber-400/90 ring-amber-300/70'
      default:
        return 'bg-emerald-500/95 ring-emerald-400/70'
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">Seat map</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              {selectedZone ? `${selectedZone.name} seating` : 'Color-coded seating layout'}
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { label: 'Free', style: 'bg-emerald-500/95' },
              { label: 'Occupied', style: 'bg-rose-500/90' },
              { label: 'Reserved', style: 'bg-amber-400/90' },
              { label: 'Blocked', style: 'bg-slate-700/90' },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-100 ${item.style}`}
              >
                <span className="h-3.5 w-3.5 rounded-full bg-white/20" />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]">
        {loading ? (
          <div className="rounded-3xl bg-slate-900/80 p-12 text-center text-slate-400">
            Loading seat layout...
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 xl:grid-cols-8">
            {seatGrid.map((seat) => {
              const isFree = seat.status?.toLowerCase() !== 'occupied' && seat.status?.toLowerCase() !== 'reserved' && seat.status?.toLowerCase() !== 'blocked'
              return (
                <button
                  key={seat.id}
                  type="button"
                  disabled={!isFree}
                  onClick={() => isFree && onSelectSeat(seat)}
                  className={`group rounded-3xl border border-white/5 p-4 text-center shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)] transition ${isFree ? 'hover:-translate-y-0.5 hover:cursor-pointer' : 'cursor-not-allowed'} ${colorClass(seat)}`}
                >
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-950/80">
                    {seat.seat_number || seat.label || String(seat.id)}
                  </p>
                  <p className="mt-3 text-base font-semibold text-slate-950">
                    {seat.status?.toUpperCase() || 'FREE'}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function ReservationScreen({
  currentReservation,
  countdown,
  cancelReservation,
  checkIn,
  setStatusMessage,
}: {
  currentReservation:
    | {
        reservationId: string | number
        seat: Seat
        zone: Zone
        expiresAt: string
      }
    | null
  countdown: number
  cancelReservation: () => Promise<void>
  checkIn: (opts?: { skipNavigate?: boolean }) => Promise<any>
  setStatusMessage: (message: string | null) => void
}) {
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const qrReaderRef = useRef<HTMLDivElement | null>(null)
  const html5QrCodeRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => html5QrCodeRef.current.clear())
          .catch(() => {})
      }
    }
  }, [])

  const startScanner = async () => {
    if (!currentReservation) return
    setScanError(null)
    setScannerOpen(true)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const qrId = 'qr-reader'
      const html5QrCode = new Html5Qrcode(qrId)
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async (decodedText: string) => {
          if (decodedText === String(currentReservation.seat.id)) {
            try {
              await html5QrCode.stop()
              await html5QrCode.clear()
            } catch (e) {
              // ignore
            }
            setScannerOpen(false)
            const sessionInfo = await checkIn()
            try {
              navigate('/active-session', { state: sessionInfo })
            } catch (e) {
              // fallback: simple navigate
              navigate('/active-session')
            }
          } else {
            setStatusMessage('Wrong seat — please scan the QR code at your reserved seat.')
          }
        },
        () => {
          return
        },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setScanError(message)
      setStatusMessage('Camera access denied or unavailable. You can use manual check-in.')
      setScannerOpen(false)
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      await html5QrCodeRef.current.stop().catch(() => {})
      await html5QrCodeRef.current.clear().catch(() => {})
      html5QrCodeRef.current = null
    }
    setScannerOpen(false)
  }
  if (!currentReservation) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
        <p className="text-lg font-semibold text-white">No active reservation</p>
        <p className="mt-3 text-sm text-slate-400">
          Select a free seat on the seat map to reserve it. Your timer will start once reserved.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">Reservation timer</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{currentReservation.zone.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{currentReservation.zone.description}</p>
          </div>
          <div className="rounded-3xl bg-gradient-to-r from-teal-600/20 to-teal-400/10 p-4 text-right">
            <p className="text-sm uppercase tracking-[0.35em] text-teal-200/80">Countdown</p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCountdown(countdown)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/80 p-6">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Seat</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {currentReservation.seat.seat_number || currentReservation.seat.label || String(currentReservation.seat.id)}
            </p>
            <p className="mt-2 text-sm text-slate-400">Reserved for zone: {currentReservation.zone.name}</p>
          </div>
          <p className="text-sm text-slate-300">
            Your seat is reserved for 15 minutes. Check in when you arrive to confirm your session, or cancel to free the seat.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
          <button
            onClick={cancelReservation}
            className="rounded-3xl border border-white/10 bg-slate-900 px-6 py-4 text-sm font-semibold text-slate-200 transition hover:border-teal-500/50 hover:text-white"
          >
            Cancel reservation
          </button>
          <button
            onClick={startScanner}
            className="rounded-3xl bg-teal-500 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
          >
            Scan QR Code to Check In
          </button>
        </div>
        {scannerOpen && (
          <div className="mt-6 rounded-3xl border border-teal-500/20 bg-slate-900/80 p-4">
            <p className="text-sm text-teal-200">Point your camera at the QR code on your reserved seat.</p>
            <div id="qr-reader" ref={qrReaderRef} className="mt-4 h-80 rounded-3xl bg-slate-950/80" />
            <button
              type="button"
              onClick={stopScanner}
              className="mt-4 rounded-3xl border border-white/10 bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Close scanner
            </button>
          </div>
        )}
        {scanError && (
          <div className="mt-4 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            Camera error: {scanError}
          </div>
        )}
        {scanError && (
          <button
            onClick={checkIn}
            className="mt-4 rounded-3xl bg-slate-800 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Manual check-in
          </button>
        )}
      </section>
    </div>
  )
}

function ActiveSessionScreen({
  activeSessionStart,
  activeSessionSeat,
  activeSessionZone,
  vacate,
}: {
  activeSessionStart: Date | null
  activeSessionSeat: Seat | null
  activeSessionZone: Zone | null
  vacate: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const location = useNavigate ? null : null
  
  // We'll attempt to read route state when props are not set
  // useNavigate is already imported above; import useLocation here
  // but since this file already imports react-router hooks at top, use useLocation
  // to access possible session info passed via navigation state
  // (we declare here to avoid shadowing earlier imports)
  //@ts-ignore
  const locState: any = null
  
  try {
    // dynamic require of react-router hooks in this local scope
  } catch (e) {}

  useEffect(() => {
    if (!activeSessionStart) return

    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - activeSessionStart.getTime()) / 1000))
    }

    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(timer)
  }, [activeSessionStart])

  if (!activeSessionStart) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 text-center text-slate-300 shadow-xl shadow-black/30">
        <p className="text-lg text-slate-300">No active session found.</p>
        <p className="mt-3 text-sm text-slate-500">Reserve a seat and check in to start tracking your session.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">Active session</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Your study session</h2>
          </div>
          <div className="rounded-3xl bg-gradient-to-r from-teal-600/20 to-teal-400/10 p-4 text-right">
            <p className="text-sm uppercase tracking-[0.35em] text-teal-200/80">Elapsed</p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCountdown(elapsed)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-900/80 p-5">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Seat</p>
            <p className="mt-3 text-xl font-semibold text-white">
              {activeSessionSeat?.seat_number || activeSessionSeat?.label || 'Unknown'}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-900/80 p-5">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Zone</p>
            <p className="mt-3 text-xl font-semibold text-white">{activeSessionZone?.name || 'Unknown'}</p>
          </div>
          <div className="rounded-3xl bg-slate-900/80 p-5">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Started</p>
            <p className="mt-3 text-xl font-semibold text-white">
              {activeSessionStart?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]">
        <p className="text-sm text-slate-300">
          Track how long your current seat has been active. Vacate the seat when you finish so the library can keep the map updated.
        </p>
        <button
          onClick={vacate}
          className="mt-6 rounded-3xl bg-rose-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-rose-400"
        >
          Vacate seat
        </button>
      </section>
    </div>
  )
}

function AdminScreen({
  seats,
  zones,
  reservations,
  summary,
  loading,
  blockSeat,
  forceRelease,
}: {
  seats: Seat[]
  zones: Zone[]
  reservations: Reservation[]
  summary: { free: number; occupied: number; reserved: number; blocked: number }
  loading: boolean
  blockSeat: (seatId: number | string) => void
  forceRelease: (seatId: number | string) => void
}) {
  const [activeAdminTab, setActiveAdminTab] = useState<'live' | 'blocks' | 'qrcodes'>('live')

  const todayReservationCount = reservations.filter((reservation) => {
    const created = reservation.created_at ? new Date(reservation.created_at).toDateString() : ''
    return created === new Date().toDateString()
  }).length

  const downloadQrCode = async (seat: Seat) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(String(seat.id), { width: 300 })
      const anchor = document.createElement('a')
      anchor.href = qrDataUrl
      const filename = seat.seat_number ? `seat-${seat.seat_number}-qr.png` : `seat-${seat.id}-qr.png`
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    } catch (error) {
      console.error('QR code generation failed', error)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl shadow-black/30">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">Admin console</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Live overview</h2>
        </div>
        <div className="flex gap-2 rounded-full bg-slate-900/80 p-1">
          {[
            { key: 'live', label: 'Live overview' },
            { key: 'blocks', label: 'Block seats' },
            { key: 'qrcodes', label: 'QR Codes' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveAdminTab(tab.key as 'live' | 'blocks' | 'qrcodes')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeAdminTab === tab.key
                  ? 'bg-teal-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-black/30">
        <div className="mt-6 grid gap-4 sm:grid-cols-5">
          {[
            { label: 'Free', value: summary.free, style: 'bg-emerald-500/90' },
            { label: 'Occupied', value: summary.occupied, style: 'bg-rose-500/90' },
            { label: 'Reserved', value: summary.reserved, style: 'bg-amber-400/90' },
            { label: 'Blocked', value: summary.blocked, style: 'bg-slate-700/90' },
            { label: 'Reserved today', value: todayReservationCount, style: 'bg-slate-900/80' },
          ].map((item) => (
            <div key={item.label} className={`rounded-3xl p-5 text-white ${item.style}`}>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-950/80">{item.label}</p>
              <p className="mt-4 text-3xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {activeAdminTab === 'live' ? (
        <section className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            {zones.map((zone) => {
              const zoneSeats = seats.filter((seat) => String(seat.zone_id) === String(zone.id))
              return (
                <div key={zone.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]">
                  <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">{zone.name}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{zone.name}</h3>
                  <p className="mt-3 text-sm text-slate-400">{zone.description}</p>
                  <div className="mt-6 space-y-3">
                    {zoneSeats.map((seat) => {
                      const blocked = seat.blocked === true || seat.status?.toLowerCase() === 'blocked'
                      const status = blocked ? 'blocked' : seat.status?.toLowerCase() || 'free'
                      return (
                        <div
                          key={seat.id}
                          className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/80 p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {seat.seat_number || seat.label || 'Unknown seat'}
                            </p>
                            <p className="text-xs text-slate-400">Status: {status}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => forceRelease(seat.id)}
                            className="rounded-2xl bg-teal-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-teal-400"
                          >
                            Release
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : activeAdminTab === 'blocks' ? (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {seats.map((seat) => {
              const blocked = seat.blocked === true || seat.status?.toLowerCase() === 'blocked'
              return (
                <div
                  key={seat.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]"
                >
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-400">{seat.seat_number || seat.label || 'Unknown seat'}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{blocked ? 'Blocked' : 'Available'}</p>
                  <p className="mt-1 text-sm text-slate-400">Zone: {seat.zone_id || 'Unknown'}</p>
                  <button
                    type="button"
                    onClick={() => blockSeat(seat.id)}
                    className={`mt-4 w-full rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                      blocked ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-rose-500 text-white hover:bg-rose-400'
                    }`}
                  >
                    {blocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-teal-400/80">QR Codes</p>
            <h3 className="mt-2 text-3xl font-semibold text-white">Download seat QR codes</h3>
            <p className="mt-3 text-sm text-slate-400">Each QR code contains the reserved seat UUID for secure check-in.</p>
          </div>
          {loading ? (
            <p className="mt-6 text-slate-400">Loading seat list...</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {seats.map((seat) => (
                <div
                  key={seat.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/80 p-5"
                >
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{seat.seat_number || seat.label || 'Unknown seat'}</p>
                  <p className="mt-3 text-xl font-semibold text-white">{seat.status || 'free'}</p>
                  <p className="mt-2 break-words text-sm text-slate-500">{seat.seat_number || seat.label || 'Unknown seat'}</p>
                  <button
                    type="button"
                    onClick={() => downloadQrCode(seat)}
                    className="mt-4 w-full rounded-3xl bg-teal-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
                  >
                    Download QR
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function AdminRestricted() {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 text-center text-slate-300 shadow-xl shadow-black/30">
      <h2 className="text-2xl font-semibold text-white">Admin access required</h2>
      <p className="mt-3 text-sm text-slate-400">
        Your account is not recognized as an admin user. Only users with{' '}
        <span className="font-semibold text-teal-300">is_admin=true</span> in the
        users table can access this panel.
      </p>
    </div>
  )
}

export default App
