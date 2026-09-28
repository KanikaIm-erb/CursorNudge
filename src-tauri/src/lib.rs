use std::process::{Child, Command};
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};


#[cfg(target_os = "macos")]
use core_graphics::{
    display::CGDisplay,
    event::{
        CGEvent,
        CGEventTapLocation,
        CGEventType,
        CGMouseButton,
    },
    event_source::{
        CGEventSource,
        CGEventSourceStateID,
    },
    geometry::CGPoint,
};


/* =========================================================
   APP STATE
========================================================= */

struct AppState {

    running: Arc<AtomicBool>,

    movement_step: Arc<AtomicUsize>,

    keep_awake: Arc<Mutex<Option<Child>>>,
}


/* =========================================================
   CURRENT TIME
========================================================= */

fn unix_time_millis() -> u64 {

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}


/* =========================================================
   KEEP AWAKE
========================================================= */

#[cfg(target_os = "macos")]
fn start_keep_awake() -> Result<Child, String> {

    Command::new("caffeinate")
        .args(["-dims"])
        .spawn()
        .map_err(
            |error| {
                format!(
                    "Could not start keep-awake: {}",
                    error
                )
            }
        )
}


fn stop_keep_awake(
    keep_awake: &Arc<Mutex<Option<Child>>>
) {

    if let Ok(mut guard) =
        keep_awake.lock()
    {

        if let Some(mut process) =
            guard.take()
        {

            let _ =
                process.kill();

            let _ =
                process.wait();

        }

    }

}


/* =========================================================
   MACOS CURSOR POSITION
========================================================= */

#[cfg(target_os = "macos")]
fn current_cursor_position()
    -> Result<CGPoint, String>
{

    let source =
        CGEventSource::new(
            CGEventSourceStateID::CombinedSessionState
        )
        .map_err(
            |_| {
                "Could not create macOS event source."
                    .to_string()
            }
        )?;


    let event =
        CGEvent::new(source)
            .map_err(
                |_| {
                    "Could not create mouse event."
                        .to_string()
                }
            )?;


    Ok(event.location())
}


/* =========================================================
   POST CURSOR MOVE
========================================================= */

#[cfg(target_os = "macos")]
fn move_cursor_to(
    position: CGPoint
) -> Result<(), String>
{

    let source =
        CGEventSource::new(
            CGEventSourceStateID::CombinedSessionState
        )
        .map_err(
            |_| {
                "Could not create macOS event source."
                    .to_string()
            }
        )?;


    let event =
        CGEvent::new_mouse_event(
            source,
            CGEventType::MouseMoved,
            position,
            CGMouseButton::Left,
        )
        .map_err(
            |_| {
                "Could not create mouse movement event."
                    .to_string()
            }
        )?;


    event.post(
        CGEventTapLocation::HID
    );


    Ok(())
}


/* =========================================================
   SUBTLE MOVEMENT
========================================================= */

#[cfg(target_os = "macos")]
fn move_subtle(
    step: usize
) -> Result<(), String>
{

    let current =
        current_cursor_position()?;


    let offset =
        if step % 2 == 0 {
            2.0
        } else {
            -2.0
        };


    let position =
        CGPoint::new(
            current.x + offset,
            current.y,
        );


    move_cursor_to(position)
}


/* =========================================================
   HORIZONTAL SWEEP
========================================================= */

#[cfg(target_os = "macos")]
fn move_horizontal(
    step: usize
) -> Result<(), String>
{

    let current =
        current_cursor_position()?;


    let bounds =
        CGDisplay::main()
            .bounds();


    let margin =
        25.0;


    let left =
        bounds.origin.x +
        margin;


    let right =
        bounds.origin.x +
        bounds.size.width -
        margin;


    let x =
        if step % 2 == 0 {
            right
        } else {
            left
        };


    let y =
        current.y.max(
            bounds.origin.y +
            margin
        )
        .min(
            bounds.origin.y +
            bounds.size.height -
            margin
        );


    move_cursor_to(
        CGPoint::new(
            x,
            y,
        )
    )
}


/* =========================================================
   VERTICAL SWEEP
========================================================= */

#[cfg(target_os = "macos")]
fn move_vertical(
    step: usize
) -> Result<(), String>
{

    let current =
        current_cursor_position()?;


    let bounds =
        CGDisplay::main()
            .bounds();


    let margin =
        25.0;


    let top =
        bounds.origin.y +
        margin;


    let bottom =
        bounds.origin.y +
        bounds.size.height -
        margin;


    let y =
        if step % 2 == 0 {
            bottom
        } else {
            top
        };


    let x =
        current.x.max(
            bounds.origin.x +
            margin
        )
        .min(
            bounds.origin.x +
            bounds.size.width -
            margin
        );


    move_cursor_to(
        CGPoint::new(
            x,
            y,
        )
    )
}


/* =========================================================
   CORNER MOVEMENT
========================================================= */

#[cfg(target_os = "macos")]
fn move_corners(
    step: usize
) -> Result<(), String>
{

    let bounds =
        CGDisplay::main()
            .bounds();


    let margin =
        25.0;


    let left =
        bounds.origin.x +
        margin;


    let right =
        bounds.origin.x +
        bounds.size.width -
        margin;


    let top =
        bounds.origin.y +
        margin;


    let bottom =
        bounds.origin.y +
        bounds.size.height -
        margin;


    let corners = [

        CGPoint::new(
            left,
            top,
        ),

        CGPoint::new(
            right,
            top,
        ),

        CGPoint::new(
            right,
            bottom,
        ),

        CGPoint::new(
            left,
            bottom,
        ),

    ];


    let position =
        corners[
            step % corners.len()
        ];


    move_cursor_to(
        position
    )
}


/* =========================================================
   MOVEMENT DISPATCHER
========================================================= */

#[cfg(target_os = "macos")]
fn perform_movement(
    movement_mode: &str,
    step: usize,
) -> Result<(), String>
{

    match movement_mode {

        "horizontal" =>
            move_horizontal(step),

        "vertical" =>
            move_vertical(step),

        "corners" =>
            move_corners(step),

        _ =>
            move_subtle(step),

    }

}


/* =========================================================
   START ACTIVITY
========================================================= */

#[tauri::command]
fn start_activity(
    interval_seconds: u64,
    duration_seconds: u64,
    movement_mode: String,
    start_at_ms: Option<u64>,
    end_at_ms: Option<u64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String>
{

    if interval_seconds < 5 {
    return Err(
        "Cursor movement interval cannot be less than 5 seconds."
            .into()
    );
}


    if state
        .running
        .load(Ordering::SeqCst)
    {

        return Ok(());

    }


    if let Some(end) =
        end_at_ms
    {

        if let Some(start) =
            start_at_ms
        {

            if end <= start {

                return Err(
                    "End time must be after start time."
                        .into()
                );

            }

        }


        if end <= unix_time_millis() {

            return Err(
                "The selected end time has already passed."
                    .into()
            );

        }

    }


    state
        .running
        .store(
            true,
            Ordering::SeqCst
        );


    state
        .movement_step
        .store(
            0,
            Ordering::SeqCst
        );


    let running =
        Arc::clone(
            &state.running
        );


    let movement_step =
        Arc::clone(
            &state.movement_step
        );


    let keep_awake =
        Arc::clone(
            &state.keep_awake
        );


    let movement_mode =
        movement_mode.clone();


    thread::spawn(
        move || {

            /* -----------------------------------------
               WAIT FOR SCHEDULED START
            ----------------------------------------- */

            if let Some(start_ms) =
                start_at_ms
            {

                loop {

                    if !running.load(
                        Ordering::SeqCst
                    ) {

                        return;

                    }


                    let now =
                        unix_time_millis();


                    if now >= start_ms {

                        break;

                    }


                    let remaining =
                        start_ms - now;


                    thread::sleep(
                        Duration::from_millis(
                            remaining.min(500)
                        )
                    );

                }

            }


            /* -----------------------------------------
               START KEEP AWAKE
            ----------------------------------------- */

            #[cfg(target_os = "macos")]
            {

                match start_keep_awake() {

                    Ok(child) => {

                        if let Ok(
                            mut guard
                        ) =
                            keep_awake.lock()
                        {

                            *guard =
                                Some(child);

                        } else {

                            running.store(
                                false,
                                Ordering::SeqCst
                            );

                            return;

                        }

                    }


                    Err(error) => {

                        eprintln!(
                            "{}",
                            error
                        );

                        running.store(
                            false,
                            Ordering::SeqCst
                        );

                        return;

                    }

                }

            }


            let start_time =
                SystemTime::now();


            /* -----------------------------------------
               MAIN ACTIVITY LOOP
            ----------------------------------------- */

            loop {

                if !running.load(
                    Ordering::SeqCst
                ) {

                    break;

                }


                /* -------------------------------------
                   END TIME
                ------------------------------------- */

                if let Some(end_ms) =
                    end_at_ms
                {

                    if unix_time_millis()
                        >= end_ms
                    {

                        break;

                    }

                }


                /* -------------------------------------
                   DURATION
                ------------------------------------- */

                if end_at_ms.is_none()
                    && duration_seconds > 0
                {

                    let elapsed =
                        start_time
                            .elapsed()
                            .unwrap_or_default()
                            .as_secs();


                    if elapsed >=
                        duration_seconds
                    {

                        break;

                    }

                }


                /* -------------------------------------
                   WAIT FOR NEXT MOVEMENT
                ------------------------------------- */

                let mut waited =
                    0u64;


                while waited <
                    interval_seconds
                {

                    if !running.load(
                        Ordering::SeqCst
                    ) {

                        break;

                    }


                    if let Some(end_ms) =
                        end_at_ms
                    {

                        if unix_time_millis()
                            >= end_ms
                        {

                            break;

                        }

                    }


                    thread::sleep(
                        Duration::from_secs(1)
                    );


                    waited += 1;

                }


                if !running.load(
                    Ordering::SeqCst
                ) {

                    break;

                }


                if let Some(end_ms) =
                    end_at_ms
                {

                    if unix_time_millis()
                        >= end_ms
                    {

                        break;

                    }

                }


                if end_at_ms.is_none()
                    && duration_seconds > 0
                {

                    let elapsed =
                        start_time
                            .elapsed()
                            .unwrap_or_default()
                            .as_secs();


                    if elapsed >=
                        duration_seconds
                    {

                        break;

                    }

                }


                /* -------------------------------------
                   MOVE CURSOR
                ------------------------------------- */

                #[cfg(target_os = "macos")]
                {

                    let step =
                        movement_step
                            .fetch_add(
                                1,
                                Ordering::SeqCst
                            );


                    if let Err(error) =
                        perform_movement(
                            &movement_mode,
                            step,
                        )
                    {

                        eprintln!(
                            "Cursor movement failed: {}",
                            error
                        );

                    }

                }

            }


            /* -----------------------------------------
               CLEANUP
            ----------------------------------------- */

            running.store(
                false,
                Ordering::SeqCst
            );


            stop_keep_awake(
                &keep_awake
            );

        }
    );


    Ok(())
}


/* =========================================================
   STOP ACTIVITY
========================================================= */

#[tauri::command]
fn stop_activity(
    state: tauri::State<'_, AppState>,
) -> Result<(), String>
{

    state
        .running
        .store(
            false,
            Ordering::SeqCst
        );


    stop_keep_awake(
        &state.keep_awake
    );


    Ok(())
}


/* =========================================================
   RUNNING STATE
========================================================= */

#[tauri::command]
fn is_running(
    state: tauri::State<'_, AppState>,
) -> bool {

    state
        .running
        .load(Ordering::SeqCst)

}


/* =========================================================
   TAURI ENTRY
========================================================= */

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {

    let state =
        AppState {

            running:
                Arc::new(
                    AtomicBool::new(
                        false
                    )
                ),

            movement_step:
                Arc::new(
                    AtomicUsize::new(
                        0
                    )
                ),

            keep_awake:
                Arc::new(
                    Mutex::new(
                        None
                    )
                ),

        };


    tauri::Builder::default()

        .manage(state)

        .plugin(
            tauri_plugin_opener::init()
        )

        .invoke_handler(
            tauri::generate_handler![
                start_activity,
                stop_activity,
                is_running
            ]
        )

        .run(
            tauri::generate_context!()
        )

        .expect(
            "error while running tauri application"
        );

}