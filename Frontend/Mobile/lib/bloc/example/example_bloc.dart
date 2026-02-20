import 'package:flutter_bloc/flutter_bloc.dart';
import 'example_event.dart';
import 'example_state.dart';

class ExampleBloc extends Bloc<ExampleEvent, ExampleState> {
  ExampleBloc() : super(const ExampleInitial()) {
    on<ExampleIncrementEvent>(_onIncrement);
    on<ExampleDecrementEvent>(_onDecrement);
    on<ExampleResetEvent>(_onReset);
  }

  void _onIncrement(ExampleIncrementEvent event, Emitter<ExampleState> emit) {
    final currentValue = state is ExampleLoaded 
        ? (state as ExampleLoaded).counter 
        : 0;
    emit(ExampleLoaded(currentValue + 1));
  }

  void _onDecrement(ExampleDecrementEvent event, Emitter<ExampleState> emit) {
    final currentValue = state is ExampleLoaded 
        ? (state as ExampleLoaded).counter 
        : 0;
    emit(ExampleLoaded(currentValue - 1));
  }

  void _onReset(ExampleResetEvent event, Emitter<ExampleState> emit) {
    emit(const ExampleLoaded(0));
  }
}
