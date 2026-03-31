(module
  (func $point_segment_hit
    (param $px f64) (param $py f64)
    (param $ax f64) (param $ay f64)
    (param $bx f64) (param $by f64)
    (param $threshold_sq f64)
    (result i32)
    (local $dx f64) (local $dy f64) (local $l2 f64)
    (local $t f64) (local $qx f64) (local $qy f64)
    (local $ddx f64) (local $ddy f64)
    (local.set $dx (f64.sub (local.get $bx) (local.get $ax)))
    (local.set $dy (f64.sub (local.get $by) (local.get $ay)))
    (local.set $l2
      (f64.add
        (f64.mul (local.get $dx) (local.get $dx))
        (f64.mul (local.get $dy) (local.get $dy))
      )
    )
    (if (f64.eq (local.get $l2) (f64.const 0))
      (then
        (local.set $ddx (f64.sub (local.get $px) (local.get $ax)))
        (local.set $ddy (f64.sub (local.get $py) (local.get $ay)))
      )
      (else
        (local.set $t
          (f64.div
            (f64.add
              (f64.mul (f64.sub (local.get $px) (local.get $ax)) (local.get $dx))
              (f64.mul (f64.sub (local.get $py) (local.get $ay)) (local.get $dy))
            )
            (local.get $l2)
          )
        )
        (if (f64.lt (local.get $t) (f64.const 0))
          (then (local.set $t (f64.const 0)))
        )
        (if (f64.gt (local.get $t) (f64.const 1))
          (then (local.set $t (f64.const 1)))
        )
        (local.set $qx (f64.add (local.get $ax) (f64.mul (local.get $t) (local.get $dx))))
        (local.set $qy (f64.add (local.get $ay) (f64.mul (local.get $t) (local.get $dy))))
        (local.set $ddx (f64.sub (local.get $px) (local.get $qx)))
        (local.set $ddy (f64.sub (local.get $py) (local.get $qy)))
      )
    )
    (if (result i32)
      (f64.le
        (f64.add
          (f64.mul (local.get $ddx) (local.get $ddx))
          (f64.mul (local.get $ddy) (local.get $ddy))
        )
        (local.get $threshold_sq)
      )
      (then (i32.const 1))
      (else (i32.const 0))
    )
  )
  (export "point_segment_hit" (func $point_segment_hit))
)
