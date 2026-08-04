package model

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type TaskFunc func()

type ScheduledTask struct {
	Name                 string        `json:"name"`
	Interval             time.Duration `json:"interval"`
	Recurring            bool          `json:"recurring"`
	function             func()
	cancel               chan struct{}
	cancelled            chan struct{}
	fromNextIntervalTime bool
	ctx                  context.Context
	cancelFunc           context.CancelFunc
	mu                   sync.Mutex
}

func CreateTask(name string, function TaskFunc, timeToExecution time.Duration) *ScheduledTask {
	return createTask(name, function, timeToExecution, false, false)
}

func CreateRecurringTask(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTask(name, function, interval, true, false)
}

func CreateRecurringTaskFromNextIntervalTime(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTask(name, function, interval, true, true)
}

// CreateTaskWithContext creates a one-time task that can be cancelled via context.
func CreateTaskWithContext(ctx context.Context, name string, function TaskFunc, timeToExecution time.Duration) *ScheduledTask {
	return createTaskWithContext(ctx, name, function, timeToExecution, false, false)
}

// CreateRecurringTaskWithContext creates a recurring task that can be cancelled via context.
func CreateRecurringTaskWithContext(ctx context.Context, name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTaskWithContext(ctx, name, function, interval, true, false)
}

// CreateRecurringTaskFromNextIntervalTimeWithContext creates a recurring task starting from the next interval boundary.
func CreateRecurringTaskFromNextIntervalTimeWithContext(ctx context.Context, name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTaskWithContext(ctx, name, function, interval, true, true)
}

func createTask(name string, function TaskFunc, interval time.Duration, recurring bool, fromNextIntervalTime bool) *ScheduledTask {
	return createTaskWithContext(context.Background(), name, function, interval, recurring, fromNextIntervalTime)
}

func createTaskWithContext(ctx context.Context, name string, function TaskFunc, interval time.Duration, recurring bool, fromNextIntervalTime bool) *ScheduledTask {
	taskCtx, cancelFunc := context.WithCancel(ctx)
	task := &ScheduledTask{
		Name:                 name,
		Interval:             interval,
		Recurring:            recurring,
		function:             function,
		cancel:               make(chan struct{}),
		cancelled:            make(chan struct{}),
		fromNextIntervalTime: fromNextIntervalTime,
		ctx:                  taskCtx,
		cancelFunc:           cancelFunc,
	}

	go func() {
		defer close(task.cancelled)
		defer task.cancelFunc()

		var firstTick <-chan time.Time
		var ticker *time.Ticker

		if task.fromNextIntervalTime {
			currTime := time.Now()
			first := currTime.Truncate(interval)
			if first.Before(currTime) {
				first = first.Add(interval)
			}
			firstTick = time.After(time.Until(first))
			ticker = nil // Use nil channel to block until firstTick fires
		} else {
			firstTick = nil
			ticker = time.NewTicker(interval)
		}

		// Proper ticker lifecycle management
		defer func() {
			if ticker != nil {
				ticker.Stop()
			}
		}()

		for {
			var tickerChan <-chan time.Time
			if ticker != nil {
				tickerChan = ticker.C
			}

			select {
			case <-firstTick:
				// First tick fired, create a real ticker and nullify firstTick
				firstTick = nil
				if ticker == nil {
					ticker = time.NewTicker(interval)
				}
				function()
			case <-tickerChan:
				function()
			case <-task.cancel:
				return
			case <-task.ctx.Done():
				return
			}

			if !task.Recurring {
				break
			}
		}
	}()

	return task
}

func (task *ScheduledTask) Cancel() {
	task.mu.Lock()
	defer task.mu.Unlock()

	select {
	case <-task.cancel:
		// Already cancelled
		return
	default:
		close(task.cancel)
	}
	<-task.cancelled
}

func (task *ScheduledTask) String() string {
	return fmt.Sprintf(
		"%s\nInterval: %s\nRecurring: %t\n",
		task.Name,
		task.Interval.String(),
		task.Recurring,
	)
}
