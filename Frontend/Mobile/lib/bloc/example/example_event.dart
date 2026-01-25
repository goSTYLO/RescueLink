import 'package:equatable/equatable.dart';

abstract class ExampleEvent extends Equatable {
  const ExampleEvent();

  @override
  List<Object> get props => [];
}

class ExampleIncrementEvent extends ExampleEvent {
  const ExampleIncrementEvent();
}

class ExampleDecrementEvent extends ExampleEvent {
  const ExampleDecrementEvent();
}

class ExampleResetEvent extends ExampleEvent {
  const ExampleResetEvent();
}
